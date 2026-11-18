export class RequestBudget {
  constructor(limit = 500) {
    this.limit = limit;
    this.used = 0;
  }

  consume() {
    this.used += 1;
    return this.used <= this.limit;
  }

  get exceeded() {
    return this.used > this.limit;
  }
}
