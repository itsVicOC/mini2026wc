const { request } = require('./request');

function getHome(options = {}) {
  return request('/api/home', {
    data: options.refresh ? { refresh: Date.now() } : {}
  });
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

function subscribeMatch(data) {
  return request('/api/subscriptions/matches', {
    method: 'POST',
    data
  });
}

function getMatchSubscriptionStatus(data) {
  return request('/api/subscriptions/matches/status', {
    method: 'POST',
    data
  });
}

module.exports = {
  getHome,
  getMatches,
  getStandings,
  getKnockouts,
  getScorers,
  subscribeMatch,
  getMatchSubscriptionStatus
};
