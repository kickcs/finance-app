export class RegisterPushDeviceCommand {
  constructor(
    public readonly userId: string,
    public readonly token: string,
    public readonly platform: 'ios' | 'android',
    public readonly deviceId?: string,
  ) {}
}
