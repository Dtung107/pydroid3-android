# Hướng Dẫn Tải Lên GitHub & Xây Dựng File .APK Cho Pydroid 3 Web

Dự án này đã được tích hợp sẵn toàn bộ cấu hình **Capacitor Android** và **GitHub Actions CI/CD**. Bạn không cần phải cài Android Studio hay cấu hình SDK phức tạp trên máy tính của mình, GitHub sẽ tự động biên dịch và tạo ra file `.apk` cài đặt trực tiếp trên điện thoại Android!

---

## 1. Tải Mã Nguồn Lên GitHub

### Cách A: Làm hoàn toàn trên điện thoại (Không cần máy tính, không cần kéo thả)
1. Mở link tạo token GitHub nhanh (đã chọn sẵn quyền `repo` và `workflow`):
   👉 **https://github.com/settings/tokens/new?scopes=repo,workflow&description=Pydroid3-APK-Builder**
2. Cuộn xuống cuối trang bấm **Generate token**, sau đó sao chép mã token (`ghp_...`).
3. Mở ứng dụng Pydroid 3 Web -> bấm **Cài đặt ⚙️** -> cuộn đến phần **"Đẩy lên GitHub & Tự động tạo file .APK"**.
4. Dán token và bấm nút **"🚀 Đẩy Lên GitHub & Tạo APK"**. Ứng dụng sẽ tự động tải lên và kích hoạt GitHub Actions tạo file APK cho bạn!

### Cách B: Dùng Git từ máy tính (Nếu có máy tính)

1. Tạo một repository mới trên GitHub (ví dụ: `pydroid3-android`).
2. Mở terminal tại thư mục dự án và chạy các lệnh sau:

```bash
git init
git add .
git commit -m "Init Pydroid 3 Android App with Gemini API & Pip auto-persistence"
git branch -M main
git remote add origin https://github.com/TÊN_TÀI_KHOẢN/pydroid3-android.git
git push -u origin main
```

*(Thay `TÊN_TÀI_KHOẢN/pydroid3-android` bằng đường dẫn GitHub repo của bạn)*.

---

## 2. GitHub Actions Tự Động Xây Dựng File .APK

Quy trình tự động đã được định nghĩa sẵn trong `.github/workflows/build-apk.yml`:

1. Ngay khi bạn `git push` lên nhánh `main` (hoặc `master`), GitHub sẽ tự động chạy quy trình **Build Android APK (Pydroid 3 Web)**.
2. Bạn cũng có thể kích hoạt thủ công:
   - Truy cập vào repository GitHub của bạn trên trình duyệt.
   - Nhấp vào tab **Actions** ở menu trên cùng.
   - Chọn workflow **Build Android APK (Pydroid 3 Web)** ở cột bên trái.
   - Nhấp vào nút **Run workflow** -> chọn nhánh `main` -> bấm **Run workflow**.
3. Chờ quá trình biên dịch hoàn tất (khoảng 2-3 phút, xuất hiện dấu tích xanh ✅).
4. Nhấp vào bản build vừa hoàn thành, cuộn xuống phần **Artifacts** ở dưới cùng.
5. Nhấp tải xuống tệp zip có tên: **`Pydroid3-Web-Android-APK`**.
6. Giải nén tệp zip sẽ nhận được file **`Pydroid3-Web.apk`** sẵn sàng cài đặt!

---

## 3. Cài Đặt File APK Lên Điện Thoại Android

1. Chuyển file `Pydroid3-Web.apk` vào điện thoại (qua Zalo, Google Drive, Telegram hoặc cáp USB).
2. Nhấn vào file APK để tiến hành cài đặt.
3. Nếu hệ điều hành Android hỏi *"Cho phép cài đặt từ nguồn này"*, hãy bật cho phép.
4. Mở ứng dụng **Pydroid 3 Web** với giao diện IDE toàn màn hình sạch sẽ, không quảng cáo, không thanh điều hướng thừa.

---

## 4. Nhập Khóa API Gemini Để Dùng Trí Tuệ Nhân Tạo Trên APK

Do file APK chạy hoàn toàn độc lập trên điện thoại di động (không cần máy chủ trung gian), cổng nhập API Gemini AI đã được tích hợp sẵn:

1. Mở ứng dụng **Pydroid 3 Web** trên điện thoại.
2. Nhấn vào biểu tượng **Cài đặt** (hình bánh răng ⚙️ ở góc trên thanh công cụ).
3. Cuộn đến mục **Cổng API Gemini AI (Dành cho APK)**.
4. Lấy API Key miễn phí từ Google:
   - Truy cập: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - Đăng nhập tài khoản Google và bấm **Create API key**.
   - Sao chép khóa bí mật bắt đầu bằng `AIzaSy...`.
5. Dán khóa API vào ô nhập trong ứng dụng.
6. Bấm **Lưu khóa API** (khóa sẽ được lưu an toàn vĩnh viễn trên bộ nhớ điện thoại của bạn).
7. Bấm **Kiểm tra kết nối** để kiểm tra. Khi hiển thị thông báo xanh:
   > *✓ Khóa API Gemini hợp lệ & kết nối AI thành công!*

Giờ đây bạn có thể sử dụng tất cả tính năng AI cao cấp:
- **Trợ lý AI Pydroid 3**: Chat hỏi đáp, giải thích mã, viết hàm thông minh.
- **Tự động Sửa Lỗi AI**: Phân tích lỗi Python và cung cấp mã sửa 1-chạm.
- **Tạo Bài Tập AI**: Tự động sinh bài học và bài tập thực hành Python theo yêu cầu.

---

## 5. Quản Lý Thư Viện Python Không Bị Mất (`pyfiglet`, `colorama`, ...)

- Toàn bộ các thư viện được cài đặt (kể cả các thư viện thuần Python bên ngoài như `pyfiglet`, `colorama`, `tabulate`, `rich`, `requests`,...) đều được lưu trữ cố định vào bộ nhớ lưu trữ `localStorage` của ứng dụng.
- Khi khởi động lại ứng dụng hoặc tắt hẳn ứng dụng trên điện thoại, hệ thống sẽ tự động khôi phục và nạp lại toàn bộ thư viện thông qua cơ chế `micropip` tự động.
- Trình chạy Python còn được trang bị **tự động phát hiện lệnh `import`**: Nếu trong mã của bạn có lệnh `import pyfiglet`, hệ thống sẽ tự động tải và cài đặt ngay tức thì mà không cần bạn phải mở bảng cài đặt trước!

---

## 6. Biên Dịch Cục Bộ Bằng Android Studio (Nếu Muốn Tùy Biến Thêm)

Nếu bạn có máy tính cài đặt Android Studio:
```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Xây dựng bản dựng web và đồng bộ sang Android
npm run cap:build

# 3. Mở mã nguồn Android trong Android Studio
npx cap open android
```
Trong Android Studio, bạn có thể tạo bản Release có chữ ký số (Sign APK) hoặc xuất bản lên Google Play Store.
