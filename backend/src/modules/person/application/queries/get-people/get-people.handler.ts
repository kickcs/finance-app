import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetPeopleQuery } from './get-people.query';
import { IPersonRepository, PERSON_REPOSITORY } from '../../../domain/repositories';
import { PersonResponseMapper } from '../../mappers';

@QueryHandler(GetPeopleQuery)
export class GetPeopleHandler implements IQueryHandler<GetPeopleQuery> {
  constructor(
    @Inject(PERSON_REPOSITORY)
    private readonly personRepository: IPersonRepository,
  ) {}

  async execute(query: GetPeopleQuery) {
    const people = await this.personRepository.findByUserId(query.userId);
    return PersonResponseMapper.toResponseList(people);
  }
}
