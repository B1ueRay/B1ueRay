const db = require('./db');

const DISTRICTS = [
  'Печерський',
  'Шевченківський',
  'Оболонський',
  'Солом\'янський',
  'Дарницький',
  'Дніпровський',
  'Голосіївський',
  'Подільський',
];

const GYMS = {
  'Печерський': ['Sport Life Печерськ', 'FitCurves Липки'],
  'Шевченківський': ['SportLife University', 'Спортклуб Спартак'],
  'Оболонський': ['Sport Life Оболонь', 'ФітКлуб Мінська'],
  'Солом\'янський': ['Fitness24 Солом\'янка', 'Атлетик Холл'],
  'Дарницький': ['Sport Life Позняки', 'ФітЦентр Дарниця'],
  'Дніпровський': ['SportLife Райдужний', 'Арена Фітнес'],
  'Голосіївський': ['Sport Life Голосіїв', 'PowerGym Васильківська'],
  'Подільський': ['Sport Life Поділ', 'Контрактова Фітнес'],
};

function run() {
  if (db.all('districts').length > 0) return;

  const districtIdByName = {};
  for (const name of DISTRICTS) {
    const d = db.insert('districts', { name });
    districtIdByName[name] = d.id;
  }

  for (const [districtName, gymNames] of Object.entries(GYMS)) {
    for (const gymName of gymNames) {
      db.insert('gyms', {
        name: gymName,
        districtId: districtIdByName[districtName],
        address: `${districtName} р-н, м. Київ`,
      });
    }
  }
}

module.exports = { run };
