import admin from '../config/firebase.js';

/**
 * Send push notification to a single device
 */
export const sendNotificationToDevice = async (fcmToken, notification, data = {}) => {
  try {
    if (!fcmToken) {
      console.log('⚠️ No FCM token provided');
      return null;
    }

    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
    return null;
  }
};

/**
 * Send notification to multiple devices
 */
export const sendNotificationToMultipleDevices = async (fcmTokens, notification, data = {}) => {
  try {
    if (!fcmTokens || fcmTokens.length === 0) {
      console.log('⚠️ No FCM tokens provided');
      return null;
    }

    const message = {
      tokens: fcmTokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ Notifications sent: ${response.successCount} success, ${response.failureCount} failed`);
    return response;
  } catch (error) {
    console.error('❌ Error sending notifications:', error.message);
    return null;
  }
};

/**
 * Account approved
 */
export const sendAccountApprovedNotification = async (fcmToken, userName) => {
  const notification = {
    title: '🎉 Account Activated!',
    body: `Welcome ${userName}! Your account has been approved and activated.`,
  };

  const data = {
    type: 'ACCOUNT_APPROVED',
    action: 'OPEN_APP',
  };

  return sendNotificationToDevice(fcmToken, notification, data);
};

/**
 * Account rejected
 */
export const sendAccountRejectedNotification = async (fcmToken, userName, reason = '') => {
  const notification = {
    title: '❌ Account Rejected',
    body:
      reason ||
      `Sorry ${userName}, your account approval request has been rejected. Please contact support.`,
  };

  const data = {
    type: 'ACCOUNT_REJECTED',
    action: 'CONTACT_SUPPORT',
  };

  return sendNotificationToDevice(fcmToken, notification, data);
};

/**
 * Welcome notification
 */
export const sendWelcomeNotification = async (fcmToken, userName) => {
  const notification = {
    title: '👋 Welcome to ManageX!',
    body: `Hi ${userName}! Your registration is successful. Please wait for admin approval.`,
  };

  const data = {
    type: 'WELCOME',
    action: 'WAIT_APPROVAL',
  };

  return sendNotificationToDevice(fcmToken, notification, data);
};
