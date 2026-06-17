const api = require('../../services/api');
const {
  canViewMatchDetail,
  groupLabel,
  openTeamDetail,
  scoreText,
  stageLabel,
  teamName
} = require('../../utils/format');
const {
  canSubscribeMatch,
  decorateSubscriptionState,
  isSubscriptionEnabled,
  login,
  requestSubscribePermission
} = require('../../utils/subscribe');

Page({
  data: {
    loading: true,
    error: '',
    matchLoading: false,
    activeGroup: 'GROUP_A',
    activeGroupText: groupLabel('GROUP_A'),
    groups: buildFixedGroups('GROUP_A'),
    allStandings: [],
    standings: [],
    groupMatches: [],
    subscribingMatchId: null,
    subscribedMatchIds: [],
    showEmpty: false
  },

  onLoad() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  onShareAppMessage() {
    return {
      title: '2026 世界杯小组赛',
      path: '/pages/standings/standings'
    };
  },

  onShareTimeline() {
    return {
      title: '2026 世界杯小组赛'
    };
  },

  onGroupTap(event) {
    this.applyGroup(event.currentTarget.dataset.value);
    this.loadGroupMatches(event.currentTarget.dataset.value);
  },

  onTeamTap(event) {
    openTeamDetail(event.currentTarget.dataset.teamId);
  },

  async loadData() {
    this.setData({ loading: true, error: '' });
    try {
      const allStandings = await api.getStandings();
      this.setData({
        allStandings,
        loading: false
      });
      this.applyGroup(this.data.activeGroup);
      this.loadGroupMatches(this.data.activeGroup);
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || '积分榜加载失败'
      });
    }
  },

  applyGroup(activeGroup) {
    const activeMeta = this.data.groups.find((group) => group.value === activeGroup);
    const activeKey = activeMeta ? activeMeta.key : groupKey(activeGroup);
    const standings = this.data.allStandings.filter((row) => groupKey(row.group) === activeKey);
    this.setData({
      activeGroup,
      activeGroupText: groupLabel(activeGroup),
      groups: this.data.groups.map((group) => ({
        ...group,
        className: group.value === activeGroup ? 'group-tab active' : 'group-tab'
      })),
      standings: standings.map((row) => ({
        ...row,
        key: `${row.group}-${row.team.apiTeamId || row.team.name}`,
        teamText: teamName(row.team),
        groupText: groupLabel(row.group),
        rankClass: row.position <= 2 ? 'qualified' : ''
      })),
      showEmpty: standings.length === 0
    });
  },

  async loadGroupMatches(group) {
    if (!group) {
      return;
    }
    const requestId = (this.matchRequestId || 0) + 1;
    this.matchRequestId = requestId;
    this.setData({ matchLoading: true, groupMatches: [] });
    try {
      const matches = await api.getMatches({ group });
      if (this.matchRequestId !== requestId) {
        return;
      }
      this.setData({
        groupMatches: this.decorateMatches(matches),
        matchLoading: false
      });
      this.loadSubscriptionStatus();
    } catch (error) {
      if (this.matchRequestId !== requestId) {
        return;
      }
      this.setData({ matchLoading: false });
      wx.showToast({ title: error.message || '小组赛程加载失败', icon: 'none' });
    }
  },

  decorateMatches(matches) {
    return matches.map((match) => ({
      ...decorateSubscriptionState(match, this.data.subscribedMatchIds, this.data.subscribingMatchId),
      scoreText: scoreText(match),
      homeName: teamName(match.homeTeam),
      awayName: teamName(match.awayTeam),
      stageText: stageLabel(match.stage),
      groupText: match.group ? groupLabel(match.group) : '',
      canViewDetail: canViewMatchDetail(match)
    }));
  },

  async onSubscribeTap(event) {
    const apiMatchId = Number(event.currentTarget.dataset.matchId);
    if (!apiMatchId || this.data.subscribingMatchId) {
      return;
    }
    const match = this.data.groupMatches.find((item) => item.apiMatchId === apiMatchId);
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
      await api.cancelMatchSubscription({ code, apiMatchId });
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

  async loadSubscriptionStatus() {
    const requestId = (this.subscriptionRequestId || 0) + 1;
    this.subscriptionRequestId = requestId;
    if (!isSubscriptionEnabled()) {
      return;
    }
    const matchIds = this.data.groupMatches
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
      if (this.subscriptionRequestId !== requestId) {
        return;
      }
      this.setData({
        subscribedMatchIds: result.subscribedMatchIds || []
      });
      this.refreshSubscriptionState();
    } catch (error) {
      console.warn('[subscription status failed]', error);
    }
  },

  refreshSubscriptionState() {
    this.setData({
      groupMatches: this.decorateMatches(this.data.groupMatches)
    });
  },

  matchName(match) {
    return `${match.homeName || teamName(match.homeTeam)} vs ${match.awayName || teamName(match.awayTeam)}`;
  }
});

function buildFixedGroups(activeGroup) {
  return Array.from({ length: 12 }).map((_, index) => {
    const letter = String.fromCharCode(65 + index);
    const value = `GROUP_${letter}`;
    return {
      label: groupLabel(value),
      value,
      key: letter,
      className: value === activeGroup ? 'group-tab active' : 'group-tab'
    };
  });
}

function groupKey(group) {
  const text = String(group || '').toUpperCase().replace(/_/g, ' ').trim();
  const match = text.match(/([A-L])$/);
  return match ? match[1] : text;
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
