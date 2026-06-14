const TEAM_NAMES = [
  ['Afghanistan', '阿富汗', 'AFG'],
  ['Albania', '阿尔巴尼亚', 'ALB'],
  ['Algeria', '阿尔及利亚', 'ALG', 'DZA'],
  ['Andorra', '安道尔', 'AND'],
  ['Angola', '安哥拉', 'ANG', 'AGO'],
  ['Argentina', '阿根廷', 'ARG'],
  ['Armenia', '亚美尼亚', 'ARM'],
  ['Australia', '澳大利亚', 'AUS'],
  ['Austria', '奥地利', 'AUT'],
  ['Azerbaijan', '阿塞拜疆', 'AZE'],
  ['Bahrain', '巴林', 'BHR'],
  ['Belarus', '白俄罗斯', 'BLR'],
  ['Belgium', '比利时', 'BEL'],
  ['Bolivia', '玻利维亚', 'BOL'],
  ['Bosnia and Herzegovina', '波黑', 'Bosnia-Herzegovina', 'BIH'],
  ['Brazil', '巴西', 'BRA'],
  ['Bulgaria', '保加利亚', 'BUL', 'BGR'],
  ['Burkina Faso', '布基纳法索', 'BFA'],
  ['Cameroon', '喀麦隆', 'CMR'],
  ['Canada', '加拿大', 'CAN'],
  ['Cape Verde', '佛得角', 'Cabo Verde', 'CPV'],
  ['Chile', '智利', 'CHI', 'CHL'],
  ['China PR', '中国', 'China', 'CHN'],
  ['Chinese Taipei', '中国台北', 'Taiwan', 'TPE'],
  ['Colombia', '哥伦比亚', 'COL'],
  ['Congo', '刚果', 'CGO'],
  ['Costa Rica', '哥斯达黎加', 'CRC'],
  ["Côte d'Ivoire", '科特迪瓦', 'Cote d Ivoire', 'Ivory Coast', 'CIV'],
  ['Croatia', '克罗地亚', 'CRO', 'HRV'],
  ['Curaçao', '库拉索', 'Curacao', 'CUW'],
  ['Czechia', '捷克', 'Czech Republic', 'CZE'],
  ['Denmark', '丹麦', 'DEN', 'DNK'],
  ['DR Congo', '刚果民主共和国', 'Congo DR', 'COD'],
  ['Ecuador', '厄瓜多尔', 'ECU'],
  ['Egypt', '埃及', 'EGY'],
  ['El Salvador', '萨尔瓦多', 'SLV'],
  ['England', '英格兰', 'ENG'],
  ['Equatorial Guinea', '赤道几内亚', 'EQG', 'GNQ'],
  ['Finland', '芬兰', 'FIN'],
  ['France', '法国', 'FRA'],
  ['Gabon', '加蓬', 'GAB'],
  ['Georgia', '格鲁吉亚', 'GEO'],
  ['Germany', '德国', 'GER', 'DEU'],
  ['Ghana', '加纳', 'GHA'],
  ['Greece', '希腊', 'GRE', 'GRC'],
  ['Guatemala', '危地马拉', 'GUA', 'GTM'],
  ['Haiti', '海地', 'HAI', 'HTI'],
  ['Honduras', '洪都拉斯', 'HON', 'HND'],
  ['Hong Kong', '中国香港', 'HKG'],
  ['Hungary', '匈牙利', 'HUN'],
  ['Iceland', '冰岛', 'ISL'],
  ['India', '印度', 'IND'],
  ['Indonesia', '印度尼西亚', 'IDN'],
  ['IR Iran', '伊朗', 'Iran', 'IRI'],
  ['Iraq', '伊拉克', 'IRQ'],
  ['Ireland', '爱尔兰', 'Republic of Ireland', 'IRL'],
  ['Israel', '以色列', 'ISR'],
  ['Italy', '意大利', 'ITA'],
  ['Jamaica', '牙买加', 'JAM'],
  ['Japan', '日本', 'JPN'],
  ['Jordan', '约旦', 'JOR'],
  ['Kazakhstan', '哈萨克斯坦', 'KAZ'],
  ['Korea DPR', '朝鲜', 'North Korea', 'PRK'],
  ['Korea Republic', '韩国', 'South Korea', 'KOR'],
  ['Kuwait', '科威特', 'KUW', 'KWT'],
  ['Kyrgyz Republic', '吉尔吉斯斯坦', 'Kyrgyzstan', 'KGZ'],
  ['Lebanon', '黎巴嫩', 'LBN'],
  ['Luxembourg', '卢森堡', 'LUX'],
  ['Malaysia', '马来西亚', 'MAS', 'MYS'],
  ['Mali', '马里', 'MLI'],
  ['Malta', '马耳他', 'MLT'],
  ['Mexico', '墨西哥', 'MEX'],
  ['Moldova', '摩尔多瓦', 'MDA'],
  ['Montenegro', '黑山', 'MNE'],
  ['Morocco', '摩洛哥', 'MAR'],
  ['Netherlands', '荷兰', 'Holland', 'NED', 'NLD'],
  ['New Zealand', '新西兰', 'NZL'],
  ['Nigeria', '尼日利亚', 'NGA'],
  ['North Macedonia', '北马其顿', 'MKD'],
  ['Northern Ireland', '北爱尔兰', 'NIR'],
  ['Norway', '挪威', 'NOR'],
  ['Oman', '阿曼', 'OMA'],
  ['Panama', '巴拿马', 'PAN'],
  ['Paraguay', '巴拉圭', 'PAR', 'PRY'],
  ['Peru', '秘鲁', 'PER'],
  ['Poland', '波兰', 'POL'],
  ['Portugal', '葡萄牙', 'POR'],
  ['Qatar', '卡塔尔', 'QAT'],
  ['Romania', '罗马尼亚', 'ROU', 'ROM'],
  ['Russia', '俄罗斯', 'RUS'],
  ['Saudi Arabia', '沙特阿拉伯', 'KSA', 'SAU'],
  ['Scotland', '苏格兰', 'SCO'],
  ['Senegal', '塞内加尔', 'SEN'],
  ['Serbia', '塞尔维亚', 'SRB'],
  ['Slovakia', '斯洛伐克', 'SVK'],
  ['Slovenia', '斯洛文尼亚', 'SVN'],
  ['South Africa', '南非', 'RSA', 'ZAF'],
  ['Spain', '西班牙', 'ESP'],
  ['Sweden', '瑞典', 'SWE'],
  ['Switzerland', '瑞士', 'SUI', 'CHE'],
  ['Syria', '叙利亚', 'SYR'],
  ['Tajikistan', '塔吉克斯坦', 'TJK'],
  ['Thailand', '泰国', 'THA'],
  ['Tunisia', '突尼斯', 'TUN'],
  ['Turkey', '土耳其', 'Türkiye', 'TUR'],
  ['Ukraine', '乌克兰', 'UKR'],
  ['United Arab Emirates', '阿联酋', 'UAE', 'ARE'],
  ['United States', '美国', 'USA', 'United States of America'],
  ['Uruguay', '乌拉圭', 'URU'],
  ['Uzbekistan', '乌兹别克斯坦', 'UZB'],
  ['Venezuela', '委内瑞拉', 'VEN'],
  ['Vietnam', '越南', 'Viet Nam', 'VIE', 'VNM'],
  ['Wales', '威尔士', 'WAL'],
  ['Zambia', '赞比亚', 'ZAM', 'ZMB']
];

const TEAM_NAME_BY_KEY = TEAM_NAMES.reduce((result, names) => {
  const chineseName = names[1];
  names.forEach((name, index) => {
    if (index !== 1) {
      result[normalizeKey(name)] = chineseName;
    }
  });
  return result;
}, {});

const TEAM_NAME_BY_API_ID = {};

function getChineseTeamName(team) {
  if (!team) {
    return '';
  }

  const apiTeamId = team.apiTeamId || team.id;
  if (apiTeamId && TEAM_NAME_BY_API_ID[String(apiTeamId)]) {
    return TEAM_NAME_BY_API_ID[String(apiTeamId)];
  }

  const candidates = [team.name, team.shortName, team.tla, team.code];
  for (const candidate of candidates) {
    const chineseName = TEAM_NAME_BY_KEY[normalizeKey(candidate)];
    if (chineseName) {
      return chineseName;
    }
  }

  return '';
}

function normalizeKey(value) {
  if (!value) {
    return '';
  }
  const text = String(value).trim().toLowerCase();
  const normalized = typeof text.normalize === 'function' ? text.normalize('NFD') : text;
  return normalized
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

module.exports = {
  getChineseTeamName
};
