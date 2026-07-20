const USER_STATUSES = ['active', 'inactive', 'pending', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export function isUserStatus(value: unknown): value is UserStatus {
  return typeof value === 'string' && (USER_STATUSES as readonly string[]).includes(value);
}

export { USER_STATUSES };
