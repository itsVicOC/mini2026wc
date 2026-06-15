import {
  getDueSubscriptions,
  isSubscribableStatus,
  markSubscriptionFailed,
  markSubscriptionSent
} from '../repositories/subscriptionRepository.js';
import { sendSubscribeMessage } from './wechatService.js';
import { logger } from '../utils/logger.js';

export async function sendDueMatchSubscriptions() {
  const subscriptions = await getDueSubscriptions();
  let sent = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    if (!isSubscribableStatus(subscription.matchStatus)) {
      await markSubscriptionFailed(subscription.id, `比赛状态已变更为 ${subscription.matchStatus}`);
      failed += 1;
      continue;
    }

    try {
      const wxMsgId = await sendSubscribeMessage({
        openid: subscription.openid,
        apiMatchId: subscription.apiMatchId,
        matchName: subscription.matchName,
        beijingTimeText: subscription.beijingTimeText
      });
      await markSubscriptionSent(subscription.id, wxMsgId);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : '订阅消息发送失败';
      await markSubscriptionFailed(subscription.id, message);
      failed += 1;
      logger.warn({ subscriptionId: subscription.id, error: message }, 'match subscription send failed');
    }
  }

  if (subscriptions.length > 0) {
    logger.info({ total: subscriptions.length, sent, failed }, 'match subscription cron finished');
  }

  return {
    total: subscriptions.length,
    sent,
    failed
  };
}
