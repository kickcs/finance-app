import { http, HttpResponse } from 'msw';

export const peopleHandlers = [
  http.get('*/api/people', () => {
    return HttpResponse.json([]);
  }),
];
