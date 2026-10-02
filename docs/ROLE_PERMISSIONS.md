# pumpd gym roles and operations

The management workspace lives at `#/management` and is available from Settings and the staff bottom navigation.

## Role matrix

| Capability | Member | Trainer | Gym owner | Admin |
| --- | :---: | :---: | :---: | :---: |
| Track workouts, weight, and health | Yes | Yes | Yes | Yes |
| View personal schedule, custom exercises, diet, and fees | Yes | Yes | Yes | Yes |
| Submit a fee for review | Yes | No | No | No |
| Create schedules for members | No | Yes (same gym) | Yes (same gym) | Yes |
| Create and assign custom exercises | No | Yes (same gym) | Yes (same gym) | Yes |
| Create and assign diet plans | No | Yes (same gym) | Yes (same gym) | Yes |
| Create and review membership fees | No | No | Yes (same gym) | Yes |
| Approve member/trainer requests | No | No | Yes (same gym) | Yes |
| Assign member/trainer roles | No | No | Yes (same gym) | Yes |
| Assign owner/admin roles or create gyms | No | No | No | Yes |

## Approval flow

1. A visitor can request access and select `member`, `trainer`, or `owner`.
2. A signed-in member can request to join a gym or request trainer access from `#/management`.
3. A gym owner only sees pending requests for their own `gymId` and can approve `member` or `trainer` requests.
4. An admin sees all request types and can approve any request, create gyms, assign roles, and assign a gym.
5. Approval creates an invite when the request is an access request. The approved role and gym are bound to the invite and cannot be changed by the registration form.

## Assignment progress tracking

Members see assigned sessions, exercises, and diet plans directly on the home screen when a trainer is assigned to them. A trainer session replaces the generic workout prompt for that day and can launch all exercises attached to the session. Members can start a library exercise in the existing workout logger, mark sessions as hit/missed, and check off diet foods by name and scheduled time. Trainers, owners, and admins see the same assignment logs in the progress tracker for their gym, including the member, date, assignment type, status, and exercise set summary.

## Fee workflow

Owners/admins create a fee with an amount and due date. Members see their fees in the management workspace and submit them for review. Owners/admins approve or reject the submission. If push notifications are enabled, a member receives one reminder per day starting three days before the due date and continuing while overdue.

## Data boundaries

All management APIs enforce role and gym boundaries on the server. Frontend route visibility is only a convenience; it is not an authorization boundary. Existing users without a `gymId` can still use pumpd normally but must be assigned to a gym before they can participate in gym-scoped management workflows.
