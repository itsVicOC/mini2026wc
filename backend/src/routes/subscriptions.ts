import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { codeToOpenid } from '../services/wechatService.js';
import {
  cancelMatchSubscription,
  getSubscribedMatchIds,
  upsertMatchSubscription
} from '../repositories/subscriptionRepository.js';
import { sendOk } from '../utils/http.js';

const subscribeSchema = z.object({
  code: z.string().min(1),
  apiMatchId: z.coerce.number().int().positive(),
  expectedUtcDate: z.string().optional(),
  expectedMatchName: z.string().optional()
});

const statusSchema = z.object({
  code: z.string().min(1),
  matchIds: z
    .union([z.string(), z.array(z.coerce.number().int().positive())])
    .optional()
});

export const subscriptionsRouter = Router();

subscriptionsRouter.post('/matches', async (req, res, next) => {
  try {
    const body = subscribeSchema.parse(req.body);
    const openid = await codeToOpenid(body.code);
    const data = await upsertMatchSubscription({
      openid,
      apiMatchId: body.apiMatchId,
      templateId: env.WECHAT_SUBSCRIBE_TEMPLATE_ID,
      expectedUtcDate: body.expectedUtcDate,
      expectedMatchName: body.expectedMatchName
    });
    sendOk(res, data);
  } catch (error) {
    next(error);
  }
});

subscriptionsRouter.post('/matches/cancel', async (req, res, next) => {
  try {
    const body = subscribeSchema.pick({ code: true, apiMatchId: true }).parse(req.body);
    const openid = await codeToOpenid(body.code);
    const data = await cancelMatchSubscription({
      openid,
      apiMatchId: body.apiMatchId,
      templateId: env.WECHAT_SUBSCRIBE_TEMPLATE_ID
    });
    sendOk(res, data);
  } catch (error) {
    next(error);
  }
});

subscriptionsRouter.post('/matches/status', async (req, res, next) => {
  try {
    const body = statusSchema.parse(req.body);
    if (!env.WECHAT_SUBSCRIBE_TEMPLATE_ID) {
      sendOk(res, { subscribedMatchIds: [] });
      return;
    }
    const openid = await codeToOpenid(body.code);
    const matchIds = normalizeMatchIds(body.matchIds);
    const subscribedMatchIds = await getSubscribedMatchIds(openid, matchIds);
    sendOk(res, { subscribedMatchIds });
  } catch (error) {
    next(error);
  }
});

function normalizeMatchIds(value: string | number[] | undefined) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}
