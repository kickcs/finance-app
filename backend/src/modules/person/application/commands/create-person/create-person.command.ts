export class CreatePersonCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly color: string,
  ) {}
}
