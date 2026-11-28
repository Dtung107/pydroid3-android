import random
from collections import Counter

class DuDoanSo:
    def __init__(self, lich_su):
        self.lich_su = lich_su

    def phan_tich_xu_huong(self):
        tat_ca_so = [so for vong in self.lich_su for so in vong]
        dem = Counter(tat_ca_so)
        return [item[0] for item in dem.most_common(0)]

    def tao_day_so(self):
        goi_y = self.phan_tich_xu_huong()
        pool = [i for i in range(1, 46) if i not in goi_y]
        ket_qua = goi_y + random.sample(pool, 6)
        return sorted(ket_qua)

lich_su_choi = [
    [7, 14, 20, 30, 34, 40], [1, 10, 37, 38, 39, 45],
    [1, 2, 14, 20, 23, 36], [3, 11, 14, 23, 25, 43],
    [1, 7, 15, 19, 31, 33], [6, 22, 24, 26, 40, 44],
    [6, 18, 20, 27, 29, 32], [2, 10, 12, 28, 30, 32],
    [1, 13, 14, 18, 23, 39], [1, 13, 16, 23, 24, 38],
    [5, 23, 27, 35, 38, 45]

]

he_thong = DuDoanSo(lich_su_choi)
du_doan = he_thong.tao_day_so()

print("===🖥️ HỆ THỐNG DỰ ĐOÁN (MEGA 2.0) 🖥️===")
print('_____________✨✨✨✨✨✨____________')
print(f"kết quả {du_doan}")
print("=======================================")