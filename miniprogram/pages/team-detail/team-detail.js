const api = require('../../services/api');
const { groupLabel, openTeamDetail, stageLabel, teamName } = require('../../utils/format');
const {
  canSubscribeMatch,
  decorateSubscriptionState,
  isSubscriptionEnabled,
  login,
  requestSubscribePermission
} = require('../../utils/subscribe');

Page({
  data: {
    apiTeamId: null,
    loading: true,
    error: '',
    detail: null,
    subscribingMatchId: null,
    subscribedMatchIds: []
  },

  onLoad(options) {
    const apiTeamId = Number(options.apiTeamId);
    if (!apiTeamId) {
      this.setData({ loading: false, error: '球队参数不正确' });
      return;
    }

    this.setData({ apiTeamId });
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  onShareAppMessage() {
    const detail = this.data.detail;
    return {
      title: detail ? `${detail.teamText}｜世界杯球队详情` : '2026 世界杯球队详情',
      path: `/pages/team-detail/team-detail?apiTeamId=${this.data.apiTeamId}`
    };
  },

  onShareTimeline() {
    const detail = this.data.detail;
    return {
      title: detail ? `${detail.teamText}｜世界杯球队详情` : '2026 世界杯球队详情'
    };
  },

  async loadData() {
    if (!this.data.apiTeamId) {
      return;
    }

    this.setData({ loading: true, error: '' });
    try {
      const data = await api.getTeamDetail(this.data.apiTeamId);
      this.setData({
        loading: false,
        detail: decorateDetail(data, this.data.subscribedMatchIds, this.data.subscribingMatchId)
      });
      this.loadSubscriptionStatus();
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '球队详情加载失败'
      });
    }
  },

  onMatchTap(event) {
    const apiMatchId = Number(event.currentTarget.dataset.matchId);
    const canViewDetail = event.currentTarget.dataset.canViewDetail;
    if (!apiMatchId || (canViewDetail !== true && canViewDetail !== 'true')) {
      return;
    }
    wx.navigateTo({
      url: `/pages/match-detail/match-detail?apiMatchId=${apiMatchId}`
    });
  },

  onTeamTap(event) {
    openTeamDetail(event.currentTarget.dataset.teamId);
  },

  async onSubscribeTap(event) {
    const apiMatchId = Number(event.currentTarget.dataset.matchId);
    if (!apiMatchId || this.data.subscribingMatchId) {
      return;
    }
    const match = this.findUpcomingMatch(apiMatchId);
    if (!match) {
      return;
    }
    if (this.data.subscribedMatchIds.indexOf(apiMatchId) >= 0) {
      this.cancelSubscription(match);
      return;
    }
    if (!canSubscribeMatch(match)) {
      this.refreshSubscriptionState();
      wx.showToast({ title: '当前比赛已不支持订阅', icon: 'none' });
      return;
    }

    this.setData({ subscribingMatchId: apiMatchId });
    this.refreshSubscriptionState();

    try {
      await requestSubscribePermission();
      const code = await login();
      await api.subscribeMatch({
        code,
        apiMatchId,
        expectedUtcDate: match.utcDate,
        expectedMatchName: this.matchName(match)
      });
      this.setData({
        subscribedMatchIds: Array.from(new Set([...this.data.subscribedMatchIds, apiMatchId])),
        subscribingMatchId: null
      });
      this.refreshSubscriptionState();
      wx.showToast({ title: '订阅成功', icon: 'success' });
    } catch (error) {
      this.setData({ subscribingMatchId: null });
      this.refreshSubscriptionState();
      wx.showToast({
        title: error.message || '订阅失败',
        icon: 'none'
      });
    }
  },

  async cancelSubscription(match) {
    const confirmed = await confirmCancelSubscription(this.matchName(match));
    if (!confirmed) {
      return;
    }

    const apiMatchId = match.apiMatchId;
    this.setData({ subscribingMatchId: apiMatchId });
    this.refreshSubscriptionState();

    try {
      const code = await login();
      await api.cancelMatchSubscription({
        code,
        apiMatchId
      });
      this.setData({
        subscribedMatchIds: this.data.subscribedMatchIds.filter((id) => id !== apiMatchId),
        subscribingMatchId: null
      });
      this.refreshSubscriptionState();
      wx.showToast({ title: '已取消订阅', icon: 'success' });
    } catch (error) {
      this.setData({ subscribingMatchId: null });
      this.refreshSubscriptionState();
      wx.showToast({
        title: error.message || '取消失败',
        icon: 'none'
      });
    }
  },

  async loadSubscriptionStatus() {
    if (!isSubscriptionEnabled() || !this.data.detail) {
      return;
    }
    const matchIds = this.data.detail.upcomingMatches
      .filter((match) => match.canSubscribe || ['SCHEDULED', 'TIMED'].indexOf(match.status) >= 0)
      .map((match) => match.apiMatchId);
    if (matchIds.length === 0) {
      return;
    }

    try {
      const code = await login();
      const result = await api.getMatchSubscriptionStatus({
        code,
        matchIds: matchIds.join(',')
      });
      this.setData({
        subscribedMatchIds: result.subscribedMatchIds || []
      });
      this.refreshSubscriptionState();
    } catch (error) {
      console.warn('[subscription status failed]', error);
    }
  },

  refreshSubscriptionState() {
    if (!this.data.detail) {
      return;
    }
    this.setData({
      detail: decorateDetail(this.data.detail, this.data.subscribedMatchIds, this.data.subscribingMatchId)
    });
  },

  findUpcomingMatch(apiMatchId) {
    return this.data.detail
      ? this.data.detail.upcomingMatches.find((match) => match.apiMatchId === apiMatchId)
      : null;
  },

  matchName(match) {
    return `${this.data.detail.teamText} vs ${match.opponentName || teamName(match.opponent)}`;
  }
});

function decorateDetail(data, subscribedMatchIds = [], loadingMatchId = null) {
  const teamText = teamName(data.team);
  const standing = data.standing;
  const overview = data.overview || {};
  const finishedMatches = (data.finishedMatches || []).map(decorateMatch);
  const upcomingMatches = (data.upcomingMatches || [])
    .map(decorateMatch)
    .map((match) => decorateSubscriptionState(match, subscribedMatchIds, loadingMatchId));
  const scorers = (data.scorers || []).map((scorer, index) => ({
    ...scorer,
    key: `${scorer.player.apiPlayerId || scorer.player.name}-${index}`,
    assistsText: scorer.assists === null || scorer.assists === undefined ? '-' : scorer.assists,
    penaltiesText: scorer.penalties === null || scorer.penalties === undefined ? '-' : scorer.penalties
  }));

  return {
    ...data,
    teamText,
    groupText: data.team.group ? groupLabel(data.team.group) : '未分组',
    standingText: standing ? `${groupLabel(standing.group)}第 ${standing.position}` : '暂无排名',
    summaryText: standing
      ? `目前积 ${standing.points} 分，${standing.won} 胜 ${standing.draw} 平 ${standing.lost} 负`
      : '等待积分榜同步',
    formItems: formatForm(standing && standing.form),
    statCards: [
      { label: '积分', value: standing ? standing.points : '-' },
      { label: '排名', value: standing ? standing.position : '-' },
      { label: '净胜球', value: standing ? signedNumber(standing.goalDifference) : '-' },
      { label: '已完赛', value: overview.finishedMatches || 0 }
    ],
    recordRows: standing
      ? [
          { label: '胜 / 平 / 负', value: `${standing.won} / ${standing.draw} / ${standing.lost}` },
          { label: '进球 / 失球', value: `${standing.goalsFor} / ${standing.goalsAgainst}` },
          { label: '本届总进球', value: overview.goalsFor || standing.goalsFor || 0 },
          { label: '本届总失球', value: overview.goalsAgainst || standing.goalsAgainst || 0 }
        ]
      : [],
    finishedMatches,
    upcomingMatches,
    scorers,
    hasScorers: scorers.length > 0
  };
}

function decorateMatch(match) {
  return {
    ...match,
    opponentName: teamName(match.opponent),
    stageText: stageLabel(match.stage),
    groupText: match.group ? groupLabel(match.group) : '',
    scoreText: scoreText(match),
    resultClass: resultClass(match.result),
    locationText: match.isHome ? '主' : '客',
    rowClass: match.canViewDetail ? 'match-item tappable' : 'match-item'
  };
}

function scoreText(match) {
  const score = match.score || {};
  if (score.team === null || score.team === undefined || score.opponent === null || score.opponent === undefined) {
    return '-';
  }
  return `${score.team} : ${score.opponent}`;
}

function resultClass(result) {
  if (result === '胜') {
    return 'result win';
  }
  if (result === '负') {
    return 'result lose';
  }
  if (result === '平') {
    return 'result draw';
  }
  return 'result pending';
}

function formatForm(form) {
  if (!form) {
    return [];
  }
  return String(form)
    .split(',')
    .map((item, index) => ({
      key: `${item}-${index}`,
      text: translateFormItem(item),
      className: `form-pill ${formClass(item)}`
    }));
}

function translateFormItem(item) {
  const value = String(item).trim().toUpperCase();
  if (value === 'W') {
    return '胜';
  }
  if (value === 'D') {
    return '平';
  }
  if (value === 'L') {
    return '负';
  }
  return value;
}

function formClass(item) {
  const value = String(item).trim().toUpperCase();
  if (value === 'W') {
    return 'win';
  }
  if (value === 'D') {
    return 'draw';
  }
  if (value === 'L') {
    return 'lose';
  }
  return '';
}

function signedNumber(value) {
  if (value === null || value === undefined) {
    return '-';
  }
  return Number(value) > 0 ? `+${value}` : String(value);
}

function confirmCancelSubscription(matchName) {
  return new Promise((resolve) => {
    wx.showModal({
      title: '取消订阅',
      content: `确定取消 ${matchName} 的开赛提醒吗？`,
      confirmText: '取消订阅',
      confirmColor: '#b23b2e',
      success(result) {
        resolve(Boolean(result.confirm));
      },
      fail() {
        resolve(false);
      }
    });
  });
}
