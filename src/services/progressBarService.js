import {Subject} from 'rxjs';

export default class ProgressBarService {

  progressBarRequested$ = new Subject();
  progressBarState$ = new Subject();

  requestProgressBar(duration = 1000) {
    console.log('request progress bar');
    this.progressBarRequested$.next({duration: duration});
    this.progressBarState$.next({state: 'MINING'});
  }

  emitProgressBarErrorState(additionalInfo) {
    this.requestProgressBar();
    this.progressBarState$.next({state: 'ERROR', additionalInfo: additionalInfo});
  }

  emitProgressBarCancelledState() {
    this.requestProgressBar();
    this.progressBarState$.next({state: 'CANCELLED'});
  }

  emitProgressBarSuccessState() {
    this.progressBarState$.next({state: 'SUCCESS'});
  }

  emitProgressBarInProgressState() {
    console.log('emit bar in progress');
    this.progressBarState$.next({state: 'IN_PROGRESS'});
  }

  emitProgressBarState(state) {
    this.progressBarState$.next(state);
  }

};