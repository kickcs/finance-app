export class UpdateProfileCommand {
  constructor(
    public readonly userId: string,
    public readonly data: {
      name?: string;
      currency?: string;
      hasCompletedOnboarding?: boolean;
      defaultAccountId?: string | null;
    },
  ) {}
}
