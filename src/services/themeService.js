import {Subject} from 'rxjs';

export default class ThemeService {
  themeChange$ = new Subject();

  emitThemeChange() {
    this.themeChange$.next(null);
  }

  observeThemeChange() {
    return this.themeChange$.asObservable();
  }
};
