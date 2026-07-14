# Thiết kế: Khai báo Riichi và Kiểm tra điều kiện Tenpai

## 1. Tổng quan
Tính năng này bổ sung khả năng khai báo Riichi cho người chơi trong luật Riichi Mahjong. Để khai báo Riichi, người chơi phải thỏa mãn các điều kiện nghiêm ngặt của luật chơi và thực hiện hành động này cùng lúc với việc đánh ra một quân bài.

## 2. Quy trình và Điều kiện khai báo Riichi
Một người chơi chỉ có thể khai báo Riichi nếu:
1. Trận đấu sử dụng luật chơi `'riichi'`.
2. Trận đấu đang ở giai đoạn chơi bài (`'playing'`).
3. Đang là lượt của người chơi đó (họ vừa bốc bài hoặc được quyền đánh bài, hand đang có 14 quân bài).
4. Người chơi chưa từng khai báo Riichi trước đó (`isRiichi === false`).
5. Hand của người chơi là **bài kín** (không chứa bất kỳ meld công khai nào, tức là mọi meld trong `player.melds` phải có `isConcealed === true` hoặc không có meld nào).
6. Người chơi có ít nhất 1000 điểm để đặt cược Riichi.
7. Sau khi loại bỏ quân bài dự định đánh ra, 13 quân bài còn lại trong hand phải ở thế **Tenpai** (chờ thắng).

## 3. Thuật toán kiểm tra Tenpai
Một bộ hand 13 quân bài được coi là **Tenpai** nếu tồn tại ít nhất một quân bài trong toàn bộ các quân bài có thể có (34 loại quân bài khác nhau) sao cho khi thêm quân bài đó vào hand, hàm `canWin` của ruleset trả về `isWin === true`.

Chúng ta sẽ triển khai phương thức `isTenpai(hand: Tile[])` trong `RiichiRuleset` thực hiện kiểm tra này bằng cách thử ghép từng loại trong 34 quân bài vào hand 13 quân bài hiện tại.

## 4. Các thay đổi và bổ sung lớp lớp (Clean Architecture)

### A. Domain Layer
* **RiichiRuleset (`riichi.ruleset.ts`):**
  * Thêm phương thức `isTenpai(hand: Tile[]): boolean`.
  * Tạo một danh sách tĩnh chứa đầy đủ 34 quân bài đại diện của Mahjong (Man 1-9, Pin 1-9, Sou 1-9, 4 Winds, 3 Dragons) làm bộ thử nghiệm.

### B. Application Layer (Use Cases)
* Tạo **`DeclareRiichiUseCase`** (`src/modules/mahjong/application/use-cases/declare-riichi.use-case.ts`):
  * **Input DTO:** `gameId`, `playerId`, `tileId` (quân bài đánh ra để báo Riichi).
  * **Các bước xử lý:**
    1. Lấy trạng thái game hiện tại từ `IGameStateRepository`.
    2. Xác thực lượt đi, luật chơi, trạng thái bài kín, điểm số hiện tại (>= 1000).
    3. Tìm quân bài `tileId` trong hand của người chơi.
    4. Sao chép hand, loại bỏ quân bài `tileId`, và gọi `ruleset.isTenpai` để kiểm tra điều kiện Tenpai của 13 quân bài còn lại. Nếu không phải Tenpai, ném ra lỗi `DomainException`.
    5. Trừ 1000 điểm của người chơi.
    6. Thiết lập `player.isRiichi = true`.
    7. Ghi lại action `'riichi'` vào lịch sử đấu (`state.addAction`).
    8. Thực hiện đánh quân bài `tileId` qua `gameEngine.discardTile` (hành động này tự động thêm quân bài vào discards, ghi lại action `'discard'` của người chơi, và chuyển lượt).
    9. Lưu trạng thái game và trả về.

### C. Presentation Layer (WebSocket)
* **GameGateway (`game.gateway.ts`):**
  * Thêm xử lý tin nhắn `@SubscribeMessage('game:riichi')`.
  * Nhận `{ gameId, tileId }` từ client, lấy `userId` từ token xác thực.
  * Gọi `DeclareRiichiUseCase.execute(...)`.
  * Phát sóng (broadcast) trạng thái trận đấu cập nhật tới tất cả người chơi trong phòng.
