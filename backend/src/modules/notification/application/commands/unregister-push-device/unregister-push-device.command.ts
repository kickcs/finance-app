export class UnregisterPushDeviceCommand {
  constructor(
    public readonly userId: string,
    public readonly token: string,
  ) {}
}
