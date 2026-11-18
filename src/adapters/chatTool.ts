import type { OfficeId } from '../core/types';

/** What the core needs from the company chat tool. */
export interface ChatTool {
  sendDirect(employeeId: string, text: string): void;
  postToOfficeChannel(office: OfficeId, text: string): void;
}

export interface ChatMessage {
  to: string; // employee id or "#OSLO" / "#BLR"
  text: string;
}

/** Simulated chat: records every message so tests can inspect them. */
export class FakeChatTool implements ChatTool {
  readonly messages: ChatMessage[] = [];

  sendDirect(employeeId: string, text: string): void {
    this.messages.push({ to: employeeId, text });
  }

  postToOfficeChannel(office: OfficeId, text: string): void {
    this.messages.push({ to: `#${office}`, text });
  }

  messagesFor(to: string): string[] {
    return this.messages.filter((m) => m.to === to).map((m) => m.text);
  }
}
