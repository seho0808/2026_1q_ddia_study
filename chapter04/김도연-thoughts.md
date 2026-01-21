새로운 기능을 추가할 때는 항상 상-하위 호환성을 생각해야한다는 것을 알게되었다.
네트워크 통신에 관한 글을 읽을 때, 네트워크 요청은 예측과 제어가 어렵다는 것을 보았다. 대부분의 애플리케이션에서 네트워크 요청은 필수일텐데 이걸 어떻게 처리할까?
RESTful API로 통신하는 웹 서비스의 경우 서버에서 에러가 발생하면 클라이언트 측에 그와 관련된 응답코드를 반환함으로써 이를 알린다. 클라이언트는 이것을 보고 서버에 다시 요청을 보낼 수 있다.
하지만 RPC기반 분산 시스템에서는 어떻게 처리해야할까? `.get()` 등을 사용하여 노드의 응답을 기다릴 수도 있다. 반드시 처리해야 하는 요청일 경우에는 `while` 문을 적절히 사용할 수도 있다. 하지만 해당 노드가 할 일을 다 끝내고 죽어버린 경우도 고려해서 설계해야한다. 타임아웃을 걸어놓는 것도 방법일 수 있다.

---
## RPC의 환상과 분산 시스템의 "좀비 태스크" 잔혹사

- **SeaTunnel Cancel 로직 트러블슈팅 사례를 중심으로 -**

### 1. 문제 현상 (Symptom)

- **상황:** SeaTunnel에서 사용자가 실행 중인 잡(Job)을 취소(Cancel)했으나, 상태가 `CANCELING`에 멈춰있고 무한정 대기(Hanging)하는 간헐적 장애 발생.
- **초기 추측:** "dead lock이나 무한 루프 문제"라고 생각했으나 깊이 파보니 RPC의 근본적인 한계와 연결됨.

---

### 2. 코드 분석: 범인은 `while`문과 `null` 체크

질문하신 `noticeTaskExecutionServiceCancel` 메서드의 핵심 로직:

```java
private void noticeTaskExecutionServiceCancel() {
        // Check whether the node exists, and whether the Task on the node exists. If there is no
        // direct update state
        if (!checkTaskGroupIsExecuting(taskGroupLocation)) {
            updateTaskState(ExecutionState.CANCELED);
            return;
        }
        int i = 0;
        // In order not to generate uncontrolled tasks, We will try again until the taskFuture is
        // completed
        Address executionAddress;
        while (!taskFuture.isDone()
                && nodeEngine
                                .getClusterService()
                                .getMember(executionAddress = getCurrentExecutionAddress())
                        != null) {
            try {
                i++;
                log.info(
                        String.format(
                                "Send cancel %s operator to member %s",
                                taskFullName, executionAddress));
                nodeEngine
                        .getOperationService()
                        .createInvocationBuilder(
                                Constant.SEATUNNEL_SERVICE_NAME,
                                new CancelTaskOperation(taskGroupLocation),
                                executionAddress)
                        .invoke()
                        .get();
                return;
            } catch (Exception e) {
                log.warn(
                        String.format(
                                "%s cancel failed with Exception: %s, retry %s",
                                this.getTaskFullName(), ExceptionUtils.getMessage(e), i));
                try {
                    Thread.sleep(2000);
                } catch (InterruptedException ex) {
                    throw new RuntimeException(ex);
                }
            }
        }
    }
```

- **결정적 결함:** `getMember(...) != null` 조건.
- 만약 노드가 일시적인 하트비트 유실로 클러스터 명단에서 잠시 빠지면, RPC 요청을 **단 한 번도 보내지 못한 채** `while` 루프가 종료됨.
- 하지만 상위 호출자는 이 메서드가 에러 없이 끝났으므로 "요청이 잘 갔다"고 착각하고 응답을 기다리는 `CANCELING` 상태에서 무한 대기함.
    
    ```java
     private void notifyTaskStatusToMaster(
                TaskGroupLocation taskGroupLocation, TaskExecutionState taskExecutionState) {
            long sleepTime = 1000;
            boolean notifyStateSuccess = false;
            while (isRunning && !notifyStateSuccess) {
                InvocationFuture<Object> invoke =
                        nodeEngine
                                .getOperationService()
                                .createInvocationBuilder(
                                        SeaTunnelServer.SERVICE_NAME,
                                        new NotifyTaskStatusOperation(
                                                taskGroupLocation, taskExecutionState),
                                        nodeEngine.getMasterAddress())
                                .invoke();
                try {
                    invoke.get();
                    notifyStateSuccess = true;
                } catch (InterruptedException e) {
                    logger.severe("send notify task status failed", e);
                } catch (JobNotFoundException e) {
                    logger.warning("send notify task status failed because can't find job", e);
                    notifyStateSuccess = true;
                } catch (ExecutionException e) {
                    if (e.getCause() instanceof JobNotFoundException) {
                        logger.warning("send notify task status failed because can't find job", e);
                        notifyStateSuccess = true;
                    } else {
                        logger.warning(ExceptionUtils.getMessage(e));
                        logger.warning(
                                String.format(
                                        "notify the job of the task(%s) status failed, retry in %s millis",
                                        taskGroupLocation, sleepTime));
                        try {
                            Thread.sleep(sleepTime);
                        } catch (InterruptedException ex) {
                            logger.severe(e);
                        }
                    }
                }
            }
        }
    ```
    

---

### 3. DDIA 4장과의 연결 (The Core Lesson)

- **RPC의 불투명성 (Problem with RPC):** 4장에서는 "네트워크 요청은 로컬 함수 호출과 다르다"고 강조함. 위 코드는 `invoke().get()`을 통해 로컬 호출처럼 결과를 기다리려 했지만, 네트워크의 **'무응답/제명'** 시나리오를 완벽히 통제하지 못함.
- **위치 투명성의 함정:** 노드가 명단에 없다고 해서 실제로 죽은 것이 아님(좀비 노드). 코드는 명단(Membership)에만 의존해 "대상이 없으니 취소할 필요 없다"고 판단했지만, 실제로는 취소되지 않은 태스크가 데이터를 계속 쓰는 위험이 존재함.

---

## 4. 대응 방식 (Why a New API, not a Fix)

이 문제에 대해 **기존 Cancel 로직을 직접 수정하지는 않았다.**

이유는 다음과 같다.

- 해당 현상은 **재현 빈도가 낮고**, 네트워크 타이밍에 따라 간헐적으로 발생함
- Cancel 로직에서 master → worker 로 보내는 operation을 반드시 보낼 수 있게 설계하는 것은 위험한 선택이다. master node는 여러 worker node를 관리해야하므로 특정 지점에서 오랫동안 정체되거나 멈춰있을 수도 있는 상황을 만들어서는 안된다.
- 즉, “완벽한 Cancel”을 만들기보다는,
    
    **운영 관점에서 확실하게 멈출 수 있는 우회로**가 필요했음
    

이런 판단 하에, 기존 로직은 유지하고 **Force Stop API를 별도로 추가**하는 방향을 선택함.

---

## 5. Force Stop 설계 방향

Force Stop은 기존 Cancel과 목적이 다름:

- Cancel: *정상 종료를 시도*
- Force Stop: *상태 일관성을 우선 확보*

이를 위해 Force Stop에서는 다음 원칙을 적용함.

1. **마스터 주도 상태 확정** 
    
    원격 노드의 응답 여부와 관계없이,
    
    마스터가 먼저 Job 상태를 `CANCELED`로 확정하고 이후 처리를 관리함.
    
2. **원격 실행 결과에 대한 비의존성**
    
    Cancel RPC의 성공 여부를 신뢰하지 않고,
    
    워커 노드에서 뒤늦게 도착하는 응답이나 재연결 상황도
    
    이미 확정된 상태를 기준으로 정리하도록 설계함.
    
3. **운영 관점의 안전장치**
    
    정상 Cancel이 실패했을 때를 대비한 **명시적인 비상 수단**으로서 제공하여,
    
    “CANCELING에 영원히 멈춘 상태”를 방지하는 데 초점을 둠.
    

---

### 5. 결론: "네트워크는 배신한다"

- "처음에 방향을 잘못 잡았던 이유는 라이브러리가 숨겨놓은 '네트워크의 불확실성'을 과소평가했기 때문입니다."
- "DDIA 4장에서 말하듯, RPC는 결코 로컬 함수가 될 수 없으며, 우리는 **실패를 기본값으로 두고(Design for Failure)** 상태 관리 로직을 설계해야 함을 이 사례를 통해 배웠습니다."
