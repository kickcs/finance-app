/**
 * UseCase interface
 * Defines the contract for application use cases
 */
export interface IUseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}
