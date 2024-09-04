import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import {
  debounceTime,
  filter,
  switchMap,
  catchError,
  of,
  Subject,
  map,
  combineLatest,
  delay,
  last,
} from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'rxjs-angular-lab';

  private searchSubject = new Subject<string>();
  searchResults: string[] = [];
  combinedResults: string[] = [];
  loading = false;
  error: string | null = null;

  constructor(private http: HttpClient) {
    // Debounced Search Observable
    this.searchSubject
      .pipe(
        debounceTime(300),
        filter((term) => term.length >= 3),
        switchMap((term) =>
          combineLatest([this.fakeApiCall(term), this.fetchData(term)]).pipe(
            map(([simpleSearchResults, combinedData]) => {
              return {
                simpleSearch: simpleSearchResults,
                combined: combinedData,
              };
            }),
            catchError((err) => {
              this.error = 'Search failed';
              this.loading = false;
              return of({ simpleSearch: [], combined: [] });
            })
          )
        )
      )
      .subscribe((results) => {
        this.searchResults = results.simpleSearch;
        this.combinedResults = results.combined;
        this.loading = false;
      });
  }

  onSearch(event: any) {
    this.loading = true;
    this.error = null;
    this.searchSubject.next(event.target.value);
  }

  fakeApiCall(term: string) {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${term}`;
    return this.http.get(url).pipe(
      map((response: any) => {
        if (response && response[0] && response[0].meanings) {
          const meanings = response[0].meanings
            .map(
              (meaning: any) =>
                `${meaning.partOfSpeech}: ${meaning.definitions
                  .map((definition: any) => definition.definition)
                  .join(', ')}`
            )
            .join('; ');
          return [`${term}: Meanings - ${meanings}`];
        } else {
          throw new Error('No meanings found');
        }
      }),
      catchError(() => of([`No meanings found for "${term}"`]))
    );
  }

  fetchData(term: string) {
    const userDetails$ = this.http
      .get<{ users: { firstName: string; lastName: string }[] }>(
        `https://dummyjson.com/users/search?q=${term}`
      )
      .pipe(
        map((response) => {
          if (response.users.length === 0) {
            throw new Error('No users found');
          }
          return response.users
            .map((user) => user.firstName + ' ' + user.lastName)
            .join(', ');
        }),
        catchError(() => of('No users found'))
      );

    const userPosts$ = this.http
      .get<{ posts: { title: string }[] }>(
        `https://dummyjson.com/posts/search?q=${term}`
      )
      .pipe(
        map((response) => {
          if (response.posts.length === 0) {
            throw new Error('No posts found');
          }
          return response.posts.map((post) => post.title).join(', ');
        }),
        catchError(() => of('No posts found'))
      );

    return combineLatest([userDetails$, userPosts$]).pipe(
      map(([userNames, postTitles]) => {
        if (userNames === 'No users found' || postTitles === 'No posts found') {
          throw new Error('No data found');
        }
        return [`Users: ${userNames}`, `Posts: ${postTitles}`];
      }),
      catchError(() => of(['No users found', 'No posts found']))
    );
  }
}
