import { LessonItem } from '../types';

export const DEFAULT_LESSONS: LessonItem[] = [
  // 🟢 Level 1: Cơ bản
  {
    id: 'lesson_1_io',
    title: '1. Nhập xuất dữ liệu với print() & input()',
    level: 'basic',
    description: 'Viết chương trình nhập tên và tuổi của bạn từ bàn phím, sau đó in ra câu chào kèm số tuổi sau 5 năm nữa.',
    starterCode: `# Nhập xuất cơ bản trong Python
# TODO: Nhập tên từ bàn phím
ten = input("Nhập họ và tên: ")

# TODO: Nhập tuổi (ép kiểu sang int)
tuoi = int(input("Nhập tuổi của bạn: "))

# TODO: In lời chào và tuổi sau 5 năm
print(f"Xin chào {ten}!")
print(f"5 năm nữa, bạn sẽ {tuoi + 5} tuổi.")
`,
    solutionCode: `# Lời giải chuẩn PEP 8
def main():
    ten = input("Nhập họ và tên: ").strip()
    tuoi = int(input("Nhập tuổi của bạn: "))
    
    print(f"Xin chào {ten}!")
    print(f"5 năm nữa, bạn sẽ {tuoi + 5} tuổi.")

if __name__ == "__main__":
    main()
`,
    explanation: 'Hàm `input()` luôn trả về kiểu chuỗi (str). Khi cần tính toán với tuổi hoặc số, bạn phải dùng hàm `int()` hoặc `float()` để ép kiểu dữ liệu.',
    sampleInput: 'Nguyễn Văn An\n18',
    sampleOutput: 'Xin chào Nguyễn Văn An!\n5 năm nữa, bạn sẽ 23 tuổi.',
  },
  {
    id: 'lesson_2_rectangle',
    title: '2. Tính chu vi & diện tích hình chữ nhật',
    level: 'basic',
    description: 'Nhập vào chiều dài và chiều rộng của hình chữ nhật. Tính và in ra chu vi, diện tích với độ chính xác 2 chữ số thập phân.',
    starterCode: `# Tính chu vi và diện tích
dai = float(input("Nhập chiều dài: "))
rong = float(input("Nhập chiều rộng: "))

# TODO: Tính chu vi và diện tích
chu_vi = (dai + rong) * 2
dien_tich = dai * rong

print(f"Chu vi: {chu_vi:.2f}")
print(f"Diện tích: {dien_tich:.2f}")
`,
    solutionCode: `def tinh_hinh_chu_nhat(dai: float, rong: float):
    chu_vi = (dai + rong) * 2
    dien_tich = dai * rong
    return chu_vi, dien_tich

def main():
    dai = float(input("Nhập chiều dài: "))
    rong = float(input("Nhập chiều rộng: "))
    
    cv, dt = tinh_hinh_chu_nhat(dai, rong)
    print(f"Chu vi: {cv:.2f}")
    print(f"Diện tích: {dt:.2f}")

if __name__ == "__main__":
    main()
`,
    explanation: 'Sử dụng f-string định dạng `{cv:.2f}` để làm tròn và hiển thị số thực với đúng 2 chữ số thập phân chuẩn mực.',
    sampleInput: '7.5\n4.2',
    sampleOutput: 'Chu vi: 23.40\nDiện tích: 31.50',
  },
  {
    id: 'lesson_3_ifelse',
    title: '3. Rẽ nhánh if...elif...else (Xếp loại học lực)',
    level: 'basic',
    description: 'Nhập điểm trung bình (0.0 đến 10.0). Xếp loại: Xuất sắc (>= 9.0), Giỏi (>= 8.0), Khá (>= 6.5), Trung bình (>= 5.0), Yếu (< 5.0).',
    starterCode: `# Xếp loại học lực
diem = float(input("Nhập điểm trung bình (0 - 10): "))

# TODO: Sử dụng cấu trúc if...elif...else
if diem >= 9.0:
    print("Xếp loại: Xuất sắc")
elif diem >= 8.0:
    print("Xếp loại: Giỏi")
elif diem >= 6.5:
    print("Xếp loại: Khá")
elif diem >= 5.0:
    print("Xếp loại: Trung bình")
else:
    print("Xếp loại: Yếu")
`,
    solutionCode: `def xep_loai(diem: float) -> str:
    if not (0.0 <= diem <= 10.0):
        return "Điểm số không hợp lệ"
    if diem >= 9.0:
        return "Xuất sắc"
    if diem >= 8.0:
        return "Giỏi"
    if diem >= 6.5:
        return "Khá"
    if diem >= 5.0:
        return "Trung bình"
    return "Yếu"

def main():
    diem = float(input("Nhập điểm trung bình (0 - 10): "))
    ket_qua = xep_loai(diem)
    print(f"Xếp loại: {ket_qua}")

if __name__ == "__main__":
    main()
`,
    explanation: 'Python đánh giá các nhánh `if...elif` theo thứ tự từ trên xuống dưới. Vì vậy ta sắp xếp kiểm tra từ mốc điểm cao nhất xuống mốc thấp nhất.',
    sampleInput: '8.6',
    sampleOutput: 'Xếp loại: Giỏi',
  },
  {
    id: 'lesson_4_for_loop',
    title: '4. Bảng cửu chương với vòng lặp for',
    level: 'basic',
    description: 'Nhập một số nguyên n (từ 1 đến 9). In ra bảng cửu chương của số đó từ 1 đến 10.',
    starterCode: `# Bảng cửu chương
n = int(input("Nhập số cần xem bảng cửu chương (1-9): "))

# TODO: Dùng vòng lặp for với range(1, 11)
print(f"--- BẢNG CỬU CHƯƠNG {n} ---")
for i in range(1, 11):
    print(f"{n} x {i} = {n * i}")
`,
    solutionCode: `def in_bang_cuu_chuong(n: int) -> None:
    print(f"--- BẢNG CỬU CHƯƠNG {n} ---")
    for i in range(1, 11):
        print(f"{n} x {i:2d} = {n * i:2d}")

if __name__ == "__main__":
    n = int(input("Nhập số (1-9): "))
    in_bang_cuu_chuong(n)
`,
    explanation: '`range(1, 11)` tạo ra chuỗi giá trị bắt đầu từ 1 đến 10 (không bao gồm cận trên 11). Dùng `:2d` để căn lề thẳng hàng.',
    sampleInput: '7',
    sampleOutput: '--- BẢNG CỬU CHƯƠNG 7 ---\n7 x  1 =  7\n7 x  2 = 14\n...\n7 x 10 = 70',
  },
  {
    id: 'lesson_5_while_loop',
    title: '5. Vòng lặp while (Tính tổng từ 1 đến N)',
    level: 'basic',
    description: 'Nhập một số nguyên dương N. Sử dụng vòng lặp while để tính tổng S = 1 + 2 + 3 + ... + N.',
    starterCode: `# Tính tổng dãy số với while
n = int(input("Nhập số nguyên dương N: "))

tong = 0
i = 1

# TODO: Viết vòng lặp while
while i <= n:
    tong += i
    i += 1

print(f"Tổng từ 1 đến {n} là: {tong}")
`,
    solutionCode: `def tinh_tong_while(n: int) -> int:
    tong = 0
    i = 1
    while i <= n:
        tong += i
        i += 1
    return tong

if __name__ == "__main__":
    n = int(input("Nhập N: "))
    print(f"Tổng từ 1 đến {n} là: {tinh_tong_while(n)}")
`,
    explanation: 'Vòng lặp `while` lặp lại chừng nào điều kiện `i <= n` còn True. Chú ý luôn tăng bước nhảy `i += 1` để tránh lặp vô tận.',
    sampleInput: '10',
    sampleOutput: 'Tổng từ 1 đến 10 là: 55',
  },

  // 🟡 Level 2: Trung cấp
  {
    id: 'lesson_6_list_ops',
    title: '6. Xử lý mảng động List (Lọc số chẵn & Min/Max)',
    level: 'intermediate',
    description: 'Cho một danh sách các số nguyên. Lọc ra danh sách chỉ chứa các số chẵn, sau đó tìm giá trị lớn nhất và nhỏ nhất trong các số chẵn đó.',
    starterCode: `# Danh sách số nguyên ban đầu
numbers = [12, 5, 8, 19, 24, 7, 30, 11, 4]

# TODO: Dùng List Comprehension để lọc số chẵn
even_numbers = [x for x in numbers if x % 2 == 0]

print("Danh sách số chẵn:", even_numbers)
print("Số chẵn lớn nhất:", max(even_numbers))
print("Số chẵn nhỏ nhất:", min(even_numbers))
`,
    solutionCode: `def xu_ly_danh_sach(ds: list[int]):
    so_chan = [x for x in ds if x % 2 == 0]
    if not so_chan:
        return [], None, None
    return so_chan, min(so_chan), max(so_chan)

numbers = [12, 5, 8, 19, 24, 7, 30, 11, 4]
chan, nho_nhat, lon_nhat = xu_ly_danh_sach(numbers)
print(f"Số chẵn: {chan}")
print(f"Min chẵn: {nho_nhat} | Max chẵn: {lon_nhat}")
`,
    explanation: 'List comprehension `[x for x in numbers if x % 2 == 0]` là cú pháp đặc trưng và cực kỳ mạnh mẽ của Python để lọc và biến đổi dữ liệu.',
    sampleOutput: 'Số chẵn: [12, 8, 24, 30, 4]\nMin chẵn: 4 | Max chẵn: 30',
  },
  {
    id: 'lesson_7_dictionary',
    title: '7. Từ điển tra cứu Dictionary (Danh bạ điện thoại)',
    level: 'intermediate',
    description: 'Xây dựng một danh bạ nhỏ bằng dict. Cho phép tra cứu số điện thoại theo tên và thêm một liên hệ mới.',
    starterCode: `# Danh bạ điện thoại
danh_ba = {
    "Nam": "0912345678",
    "Hoa": "0987654321",
    "Tuấn": "0901234567"
}

# TODO: Thêm liên hệ mới "Linh": "0933445566"
danh_ba["Linh"] = "0933445566"

# TODO: Tra cứu an toàn với hàm .get()
ten_tra_cuu = "Hoa"
sdt = danh_ba.get(ten_tra_cuu, "Không tìm thấy")
print(f"SĐT của {ten_tra_cuu}: {sdt}")

print("\nToàn bộ danh bạ:")
for ten, so in danh_ba.items():
    print(f"- {ten}: {so}")
`,
    solutionCode: `class PhoneBook:
    def __init__(self):
        self.contacts = {}

    def add(self, name: str, phone: str):
        self.contacts[name] = phone

    def find(self, name: str) -> str:
        return self.contacts.get(name, "Không tìm thấy liên hệ!")

pb = PhoneBook()
pb.add("Nam", "0912345678")
pb.add("Hoa", "0987654321")
print("Tra cứu Hoa:", pb.find("Hoa"))
print("Tra cứu An:", pb.find("An"))
`,
    explanation: 'Hàm `dict.get(key, default)` giúp truy xuất giá trị an toàn mà không làm chương trình bị văng lỗi `KeyError` nếu từ khóa không tồn tại.',
    sampleOutput: 'SĐT của Hoa: 0987654321\nToàn bộ danh bạ:\n- Nam: 0912345678...',
  },
  {
    id: 'lesson_8_is_prime',
    title: '8. Hàm tự định nghĩa def is_prime() (Kiểm tra số nguyên tố)',
    level: 'intermediate',
    description: 'Định nghĩa hàm is_prime(n) kiểm tra số nguyên tố tối ưu chạy tới căn bậc hai của n, sau đó in các số nguyên tố trong khoảng 1 đến 50.',
    starterCode: `import math

def is_prime(n: int) -> bool:
    if n < 2:
        return False
    # TODO: Duyệt từ 2 đến căn bậc hai của n
    for i in range(2, int(math.isqrt(n)) + 1):
        if n % i == 0:
            return False
    return True

# In các số nguyên tố từ 1 đến 50
primes = [x for x in range(1, 51) if is_prime(x)]
print("Các số nguyên tố từ 1 đến 50:")
print(primes)
`,
    solutionCode: `import math

def is_prime(n: int) -> bool:
    """Kiểm tra số nguyên tố tối ưu O(sqrt(n))."""
    if n <= 1:
        return False
    if n <= 3:
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    
    i = 5
    while i * i <= n:
        if n % i == 0 or n % (i + 2) == 0:
            return False
        i += 6
    return True

print("Số nguyên tố <= 50:")
print([x for x in range(1, 51) if is_prime(x)])
`,
    explanation: 'Kiểm tra đến `isqrt(n)` giảm số bước kiểm tra từ O(n) xuống O(√n), giúp chương trình chạy nhanh hơn hàng nghìn lần khi n lớn.',
    sampleOutput: '[2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]',
  },
  {
    id: 'lesson_9_string_clean',
    title: '9. Chuẩn hóa chuỗi văn bản & Xử lý từ',
    level: 'intermediate',
    description: 'Chuẩn hóa một chuỗi văn bản nhập bừa bãi: xóa khoảng trắng thừa ở hai đầu và giữa các từ, viết hoa chữ cái đầu mỗi từ (Title Case).',
    starterCode: `raw_text = "   lẬp   tTrình   pYTHON   trên   aNDROID  "

# TODO: Tách các từ và loại bỏ khoảng trắng thừa
words = raw_text.split()

# TODO: Viết hoa chữ đầu mỗi từ và ghép lại
normalized_text = " ".join(word.capitalize() for word in words)

print("Chuỗi gốc:     ", repr(raw_text))
print("Chuỗi chuẩn hóa:", repr(normalized_text))
`,
    solutionCode: `def chuan_hoa_ho_ten(s: str) -> str:
    # .split() không tham số tự động xóa toàn bộ khoảng trắng thừa liên tiếp
    tu_danh_sach = s.strip().split()
    return " ".join(tu.capitalize() for tu in tu_danh_sach)

vi_du = "   nGUYễn    vĂN   aN   "
print("Kết quả:", chuan_hoa_ho_ten(vi_du))
`,
    explanation: '`str.split()` không truyền tham số sẽ tự động phân tách theo bất kỳ khoảng trắng liên tiếp nào (spaces, tabs, newlines) và loại bỏ khoảng trắng thừa.',
    sampleOutput: "Chuỗi chuẩn hóa: 'Lập Ttrình Python Trên Android'",
  },
  {
    id: 'lesson_10_try_except',
    title: '10. Bắt lỗi ngoại lệ với try...except (Phép chia an toàn)',
    level: 'intermediate',
    description: 'Viết chương trình nhập hai số a và b. Dùng khối try...except để bắt lỗi chia cho số 0 (ZeroDivisionError) và lỗi nhập chữ thay vì số (ValueError).',
    starterCode: `try:
    a = float(input("Nhập số bị chia a: "))
    b = float(input("Nhập số chia b: "))
    
    # TODO: Thực hiện phép chia
    ket_qua = a / b
    print(f"Kết quả {a} / {b} = {ket_qua:.2f}")

except ValueError:
    print("❌ Lỗi: Bạn phải nhập vào số thực hợp lệ!")
except ZeroDivisionError:
    print("❌ Lỗi: Không thể thực hiện phép chia cho số 0!")
finally:
    print("Hoàn tất phép tính.")
`,
    solutionCode: `def phep_chia_an_toan():
    try:
        a = float(input("Nhập a: "))
        b = float(input("Nhập b: "))
        return f"{a} / {b} = {a / b:.4f}"
    except ValueError:
        return "Lỗi: Dữ liệu nhập vào không phải là số!"
    except ZeroDivisionError:
        return "Lỗi: Không thể chia cho 0!"

print(phep_chia_an_toan())
`,
    explanation: 'Khối `try...except` giúp ứng dụng không bị dừng đột ngột (crash) khi gặp lỗi ngoại lệ từ người dùng hoặc hệ thống.',
    sampleInput: '10\n0',
    sampleOutput: '❌ Lỗi: Không thể thực hiện phép chia cho số 0!\nHoàn tất phép tính.',
  },

  // 🟣 Level 3: Nâng cao
  {
    id: 'lesson_11_oop_student',
    title: '11. Lập trình hướng đối tượng OOP (class Student)',
    level: 'advanced',
    description: 'Xây dựng class Student với các thuộc tính tên, năm sinh, điểm số. Phương thức tính tuổi, tính điểm trung bình và xếp loại.',
    starterCode: `from datetime import datetime

class Student:
    def __init__(self, name: str, birth_year: int, scores: list[float]):
        self.name = name
        self.birth_year = birth_year
        self.scores = scores

    def get_age(self) -> int:
        current_year = datetime.now().year
        return current_year - self.birth_year

    def get_average(self) -> float:
        if not self.scores:
            return 0.0
        return sum(self.scores) / len(self.scores)

    def __str__(self):
        return f"Sinh viên: {self.name} | Tuổi: {self.get_age()} | ĐTB: {self.get_average():.2f}"

# Tạo đối tượng thử nghiệm
sv = Student("Trần Bảo Minh", 2004, [8.5, 9.0, 7.5, 9.5])
print(sv)
`,
    solutionCode: `from datetime import datetime

class Student:
    def __init__(self, name: str, birth_year: int, scores: list[float]):
        self.name = name
        self.birth_year = birth_year
        self.scores = scores

    @property
    def age(self) -> int:
        return datetime.now().year - self.birth_year

    @property
    def gpa(self) -> float:
        return sum(self.scores) / len(self.scores) if self.scores else 0.0

    def __repr__(self) -> str:
        return f"<Student {self.name}: Tuổi {self.age}, GPA {self.gpa:.2f}>"

if __name__ == "__main__":
    sv = Student("Trần Bảo Minh", 2004, [8.5, 9.0, 7.5, 9.5])
    print(sv)
`,
    explanation: 'Decorator `@property` cho phép truy xuất phương thức tính toán giống như một thuộc tính thông thường (`sv.age` thay vì `sv.get_age()`).',
    sampleOutput: 'Sinh viên: Trần Bảo Minh | Tuổi: 22 | ĐTB: 8.62',
  },
  {
    id: 'lesson_12_inheritance',
    title: '12. Kế thừa & Đa hình (Employee & Manager)',
    level: 'advanced',
    description: 'Xây dựng lớp cha Person, lớp con Employee và Manager ghi đè phương thức tính lương và hiển thị thông tin.',
    starterCode: `class Employee:
    def __init__(self, emp_id: str, name: str, base_salary: float):
        self.emp_id = emp_id
        self.name = name
        self.base_salary = base_salary

    def calculate_salary(self) -> float:
        return self.base_salary

    def info(self) -> str:
        return f"NV [{self.emp_id}] {self.name} - Lương: {self.calculate_salary():,.0f} VNĐ"

class Manager(Employee):
    def __init__(self, emp_id: str, name: str, base_salary: float, bonus: float):
        super().__init__(emp_id, name, base_salary)
        self.bonus = bonus

    def calculate_salary(self) -> float:
        return self.base_salary + self.bonus

# Kiểm tra tính đa hình
staff = [
    Employee("NV01", "Hoàng Nam", 12000000),
    Manager("QL01", "Đỗ Hương", 25000000, 8000000)
]

for person in staff:
    print(person.info())
`,
    solutionCode: `class Employee:
    def __init__(self, emp_id: str, name: str, base_salary: float):
        self.emp_id = emp_id
        self.name = name
        self.base_salary = base_salary

    def calculate_salary(self) -> float:
        return self.base_salary

    def info(self) -> str:
        return f"[{self.emp_id}] {self.name} - Lương: {self.calculate_salary():,.0f} VNĐ"

class Manager(Employee):
    def __init__(self, emp_id: str, name: str, base_salary: float, bonus: float):
        super().__init__(emp_id, name, base_salary)
        self.bonus = bonus

    def calculate_salary(self) -> float:
        return super().calculate_salary() + self.bonus

staff = [
    Employee("NV01", "Hoàng Nam", 12_000_000),
    Manager("QL01", "Đỗ Hương", 25_000_000, 8_000_000)
]
for s in staff:
    print(s.info())
`,
    explanation: 'Tính đa hình (Polymorphism) cho phép đối tượng `Manager` và `Employee` cùng đáp ứng phương thức `calculate_salary()` nhưng trả về giá trị khác nhau.',
    sampleOutput: '[NV01] Hoàng Nam - Lương: 12,000,000 VNĐ\n[QL01] Đỗ Hương - Lương: 33,000,000 VNĐ',
  },
  {
    id: 'lesson_13_binary_search',
    title: '13. Thuật toán tìm kiếm nhị phân (Binary Search)',
    level: 'advanced',
    description: 'Cài đặt thuật toán Binary Search trên mảng đã sắp xếp với độ phức tạp thời gian O(log N). Trả về chỉ số vị trí tìm thấy hoặc -1.',
    starterCode: `def binary_search(arr: list[int], target: int) -> int:
    left = 0
    right = len(arr) - 1

    # TODO: Vòng lặp chia đôi không gian tìm kiếm
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
            
    return -1

# Dữ liệu thử nghiệm đã sắp xếp
sorted_data = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
can_tim = 23
vi_tri = binary_search(sorted_data, can_tim)

print(f"Mảng: {sorted_data}")
print(f"Tìm {can_tim} -> Vị trí index: {vi_tri}")
`,
    solutionCode: `def binary_search(arr: list[int], target: int) -> int:
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

numbers = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
print("Index của 23:", binary_search(numbers, 23))
print("Index của 100:", binary_search(numbers, 100))
`,
    explanation: 'Binary Search chia đôi khoảng tìm kiếm sau mỗi vòng lặp, nên với danh sách 1 triệu phần tử, chỉ cần tối đa khoảng 20 phép so sánh!',
    sampleOutput: 'Mảng: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]\nTìm 23 -> Vị trí index: 5',
  },
  {
    id: 'lesson_14_number_guess',
    title: '14. Mini-Game Đoán Số Thông Minh',
    level: 'advanced',
    description: 'Chương trình máy tính tự tạo một số bí mật ngẫu nhiên trong khoảng 1 đến 100. Người chơi đoán số và nhận gợi ý lớn hơn/nhỏ hơn cho đến khi trúng.',
    starterCode: `import random

def tro_choi_doan_so():
    # Máy chọn số ngẫu nhiên từ 1 đến 100
    secret = random.randint(1, 100)
    so_lan_doan = 0
    print("🎮 CHÀO MỪNG ĐẾN VỚI MINI-GAME ĐOÁN SỐ (1 - 100)!")
    
    # Giả lập 1 lượt đoán mẫu
    doan = int(input("Nhập số bạn đoán: "))
    so_lan_doan += 1
    
    if doan == secret:
        print(f"🎉 Xuất sắc! Bạn đoán đúng số {secret} ngay lần đầu!")
    elif doan < secret:
        print(f"Số bí mật LỚN HƠN {doan}! (Số bí mật là: {secret})")
    else:
        print(f"Số bí mật NHỎ HƠN {doan}! (Số bí mật là: {secret})")

tro_choi_doan_so()
`,
    solutionCode: `import random

def play_game():
    secret = random.randint(1, 100)
    attempts = 0
    print("🎯 Hãy đoán số bí mật từ 1 đến 100!")
    
    while True:
        try:
            guess = int(input("Lượt đoán: "))
            attempts += 1
            if guess == secret:
                print(f"🎉 CHÍNH XÁC! Bạn thắng sau {attempts} lần đoán!")
                break
            elif guess < secret:
                print("🔼 Số bí mật LỚN HƠN!")
            else:
                print("🔽 Số bí mật NHỎ HƠN!")
        except ValueError:
            print("Vui lòng chỉ nhập số nguyên!")

if __name__ == "__main__":
    play_game()
`,
    explanation: 'Trò chơi kết hợp module `random`, vòng lặp `while True`, xử lý biệt lệ `try...except` và câu lệnh rẽ nhánh `if...elif...else` hoàn chỉnh.',
    sampleInput: '50',
    sampleOutput: '🎮 CHÀO MỪNG ĐẾN VỚI MINI-GAME ĐOÁN SỐ (1 - 100)!\nSố bí mật LỚN HƠN 50!...',
  },
];
