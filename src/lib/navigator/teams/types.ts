/** Adaptive Card v1.5 types for MS Teams Workflow webhooks */

export interface AdaptiveCardAction {
  type: "Action.OpenUrl";
  title: string;
  url: string;
}

export interface AdaptiveCardElement {
  type: string;
  text?: string;
  weight?: string;
  size?: string;
  color?: string;
  wrap?: boolean;
  spacing?: string;
  separator?: boolean;
  isSubtle?: boolean;
  style?: string;
  columns?: AdaptiveCardColumn[];
  items?: AdaptiveCardElement[];
  width?: string | number;
  fontType?: string;
  horizontalAlignment?: string;
  height?: string;
}

export interface AdaptiveCardColumn {
  type: "Column";
  width: string | number;
  items: AdaptiveCardElement[];
}

export interface AdaptiveCard {
  type: "AdaptiveCard";
  $schema: string;
  version: string;
  body: AdaptiveCardElement[];
  actions?: AdaptiveCardAction[];
}

/** Payload wrapper for Teams Workflow webhook */
export interface TeamsWebhookPayload {
  type: "message";
  attachments: [{
    contentType: "application/vnd.microsoft.card.adaptive";
    content: AdaptiveCard;
  }];
}

/** Config stored in admin_config.notifications */
export interface TeamsNotificationConfig {
  teamsEnabled: boolean;
  teamChannelWebhookUrl: string;
  enabledNotifications: string[]; // "due_steps" | "exports" | "weekly" | "announcements"
}

/** Per-user Teams config stored in user_config.preferences */
export interface UserTeamsPreferences {
  teamsWebhookUrl?: string;
  teamsNotificationsEnabled?: boolean;
}

/** Data shapes for card builders */
export interface DueStepCardItem {
  contactName: string;
  companyName: string;
  channel: string;
  stepNumber: number;
  totalSteps: number;
}

export interface ExportSummaryData {
  userName: string;
  contactCount: number;
  companyDomain: string;
  format: string;
}

export interface WeeklyDigestStats {
  exportsCount: number;
  sequencesStarted: number;
  stepsCompleted: number;
  companiesDiscovered: number;
  activeUsers: string[];
  period: string; // e.g. "Feb 3 – Feb 9"
}

export interface AnnouncementData {
  title: string;
  body: string;
  author: string;
}
