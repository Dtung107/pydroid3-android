import operator

def may_tinh():
    ops = {'+': operator.add, '-': operator.sub, '*': operator.mul, '/': operator.truediv}
    
    while True:
        try:
            a = float(input("Số 1: "))
            op = input("Phép tính (+-*/): ")
            b = float(input("Số 2: "))
            
            # Thực hiện phép tính
            res = ops[op](a, b)
            print(f"Kết quả: {res}")
        except (ValueError, KeyError, ZeroDivisionError):
            print("Lỗi đầu vào!")
            
        if input("Thoát? (c/k): ") == 'c': break

if __name__ == "__main__":
    may_tinh()