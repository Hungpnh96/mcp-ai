import { fetchJson } from './common.js';

const lunarInfo = document.getElementById('lunarInfo');
const lunarDate = document.getElementById('lunarDate');
const btnLunar = document.getElementById('btnLunar');

const vnMonthMap = {
  正月: 'Tháng Giêng',
  一月: 'Tháng Giêng',
  二月: 'Tháng Hai',
  三月: 'Tháng Ba',
  四月: 'Tháng Tư',
  五月: 'Tháng Năm',
  六月: 'Tháng Sáu',
  七月: 'Tháng Bảy',
  八月: 'Tháng Tám',
  九月: 'Tháng Chín',
  十月: 'Tháng Mười',
  冬月: 'Tháng Mười Một',
  十一月: 'Tháng Mười Một',
  腊月: 'Tháng Chạp',
  十二月: 'Tháng Chạp',
};

const vnDayMap = {
  初一: 'Mồng Một',
  初二: 'Mồng Hai',
  初三: 'Mồng Ba',
  初四: 'Mồng Bốn',
  初五: 'Mồng Năm',
  初六: 'Mồng Sáu',
  初七: 'Mồng Bảy',
  初八: 'Mồng Tám',
  初九: 'Mồng Chín',
  初十: 'Mồng Mười',
  十一: 'Mười Một',
  十二: 'Mười Hai',
  十三: 'Mười Ba',
  十四: 'Mười Bốn',
  十五: 'Rằm',
  十六: 'Mười Sáu',
  十七: 'Mười Bảy',
  十八: 'Mười Tám',
  十九: 'Mười Chín',
  二十: 'Hai Mươi',
  廿一: 'Hai Mươi Mốt',
  廿二: 'Hai Mươi Hai',
  廿三: 'Hai Mươi Ba',
  廿四: 'Hai Mươi Bốn',
  廿五: 'Hai Mươi Lăm',
  廿六: 'Hai Mươi Sáu',
  廿七: 'Hai Mươi Bảy',
  廿八: 'Hai Mươi Tám',
  廿九: 'Hai Mươi Chín',
  三十: 'Ba Mươi',
};

const heavenlyStems = {
  甲: 'Giáp',
  乙: 'Ất',
  丙: 'Bính',
  丁: 'Đinh',
  戊: 'Mậu',
  己: 'Kỷ',
  庚: 'Canh',
  辛: 'Tân',
  壬: 'Nhâm',
  癸: 'Quý',
};

const earthlyBranches = {
  子: 'Tý',
  丑: 'Sửu',
  寅: 'Dần',
  卯: 'Mão',
  辰: 'Thìn',
  巳: 'Tỵ',
  午: 'Ngọ',
  未: 'Mùi',
  申: 'Thân',
  酉: 'Dậu',
  戌: 'Tuất',
  亥: 'Hợi',
};

const animalMap = {
  鼠: 'Tý', Rat: 'Tý',
  牛: 'Sửu', Ox: 'Sửu',
  虎: 'Dần', Tiger: 'Dần',
  兔: 'Mão', Rabbit: 'Mão', Cat: 'Mão',
  龍: 'Thìn', 龙: 'Thìn', Dragon: 'Thìn',
  蛇: 'Tỵ', Snake: 'Tỵ',
  馬: 'Ngọ', 马: 'Ngọ', Horse: 'Ngọ',
  羊: 'Mùi', Goat: 'Mùi', Sheep: 'Mùi',
  猴: 'Thân', Monkey: 'Thân',
  雞: 'Dậu', 鸡: 'Dậu', Rooster: 'Dậu',
  狗: 'Tuất', Dog: 'Tuất',
  豬: 'Hợi', 猪: 'Hợi', Pig: 'Hợi',
};

function translateMonth(label) {
  if (!label) return '—';
  const isLeap = label.includes('闰');
  const cleaned = label.replace('闰', '');
  const mapped = vnMonthMap[cleaned] || cleaned;
  return isLeap ? `${mapped} (nhuận)` : mapped;
}

function translateDay(label) {
  if (!label) return '—';
  return vnDayMap[label] || label;
}

function translateCanChi(value) {
  if (!value) return '—';
  const chars = Array.from(value);
  return chars
    .map((ch) => heavenlyStems[ch] || earthlyBranches[ch] || ch)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function translateAnimal(value) {
  if (!value) return '—';
  return animalMap[value] || value;
}

function setDefaultDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  if (lunarDate) lunarDate.value = `${yyyy}-${mm}-${dd}`;
}

async function refreshLunar() {
  if (lunarInfo) lunarInfo.innerHTML = 'Đang tải...';
  const date = lunarDate?.value;
  try {
    const data = await fetchJson('/api/lunar-calendar', date ? { date } : undefined);
    if (lunarInfo && data?.lunar) {
      const solar = data.solar || {};
      const lunar = data.lunar || {};
      const lines = [
        {
          label: 'Ngày âm',
          value: `${String(lunar.lDay || '—').padStart(2, '0')} / ${String(lunar.lMonth || '—').padStart(2, '0')} / ${lunar.lYear ?? '----'} (${translateMonth(lunar.IMonthCn)} · ${translateDay(lunar.IDayCn)})`,
        },
        {
          label: 'Can Chi',
          value: `${translateCanChi(lunar.gzYear || lunar.GanZhiYear)} · ${translateCanChi(lunar.gzMonth || lunar.GanZhiMonth)} · ${translateCanChi(lunar.gzDay || lunar.GanZhiDay)}`,
        },
        {
          label: 'Tiết khí',
          value: lunar.jieqi || '—',
        },
        {
          label: 'Ngày dương',
          value: `${solar.day?.toString().padStart(2, '0') || '--'} / ${solar.month?.toString().padStart(2, '0') || '--'} / ${solar.year ?? '----'}`,
        },
        {
          label: 'Tuổi con giáp',
          value: translateAnimal(lunar.animal || lunar.animalYear),
        },
      ];
      lunarInfo.innerHTML = lines
        .map(
          ({ label, value }) => `
            <div class="lunar-line">
              <span>${label}</span>
              <strong>${value}</strong>
            </div>
          `,
        )
        .join('');
    } else if (lunarInfo) {
      lunarInfo.innerHTML = 'Không có dữ liệu lịch âm.';
    }
  } catch (err) {
    if (lunarInfo) lunarInfo.innerHTML = `Lỗi: ${String(err)}`;
  }
}

btnLunar?.addEventListener('click', refreshLunar);

setDefaultDate();
refreshLunar();
