import type { Response } from 'express'
import { Notification, type NotificationCategory } from '../models/Notification.js'

type Subscriber = {
  response: Response
  heartbeat: NodeJS.Timeout
}

type NotificationPayload = {
  userId: string | string[]
  category: NotificationCategory
  title: string
  message: string
  actionUrl?: string
}

const subscribers = new Map<string, Set<Subscriber>>()

function sendSse(response: Response, event: string, data: unknown) {
  response.write(`event: ${event}\n`)
  response.write(`data: ${JSON.stringify(data)}\n\n`)
}

export function subscribeToNotifications(userId: string, response: Response) {
  const heartbeat = setInterval(() => {
    response.write(': ping\n\n')
  }, 20000)

  const subscriber: Subscriber = { response, heartbeat }
  const current = subscribers.get(userId) ?? new Set<Subscriber>()
  current.add(subscriber)
  subscribers.set(userId, current)

  sendSse(response, 'ready', { connected: true })

  return () => {
    clearInterval(heartbeat)
    const userSubscribers = subscribers.get(userId)
    if (!userSubscribers) return
    userSubscribers.delete(subscriber)
    if (userSubscribers.size === 0) {
      subscribers.delete(userId)
    }
  }
}

function emitToUser(userId: string, event: string, data: unknown) {
  const userSubscribers = subscribers.get(userId)
  if (!userSubscribers || userSubscribers.size === 0) return

  for (const subscriber of userSubscribers) {
    sendSse(subscriber.response, event, data)
  }
}

function serializeNotification(item: any) {
  return {
    _id: item._id.toString(),
    category: item.category,
    title: item.title,
    message: item.message,
    actionUrl: item.actionUrl,
    isRead: item.isRead,
    createdAt: item.createdAt,
  }
}

export async function createNotification(payload: NotificationPayload) {
  const targetUserIds = Array.from(new Set(Array.isArray(payload.userId) ? payload.userId : [payload.userId]))

  if (targetUserIds.length === 0) return []

  const notifications = await Promise.all(
    targetUserIds.map((id) =>
      Notification.create({
        userId: id,
        category: payload.category,
        title: payload.title,
        message: payload.message,
        actionUrl: payload.actionUrl,
      })
    )
  )

  await Promise.all(
    targetUserIds.map(async (id, index) => {
      const unreadCount = await Notification.countDocuments({ userId: id, isRead: false })
      emitToUser(id, 'notification', {
        notification: serializeNotification(notifications[index]),
        unreadCount,
      })
    })
  )

  return notifications
}

export async function emitUnreadCount(userId: string) {
  const unreadCount = await Notification.countDocuments({ userId, isRead: false })
  emitToUser(userId, 'unread-count', { unreadCount })
}