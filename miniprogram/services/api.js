const { request } = require('./request');

function getHome() {
  return request('/api/home');
}

function getMatches(params = {}) {
  return request('/api/matches', {
    data: params
  });
}

function getStandings(group) {
  return request('/api/standings', {
    data: group ? { group } : {}
  });
}

function getKnockouts() {
  return request('/api/knockouts');
}

function getScorers(limit = 20) {
  return request('/api/scorers', {
    data: { limit }
  });
}

module.exports = {
  getHome,
  getMatches,
  getStandings,
  getKnockouts,
  getScorers
};

