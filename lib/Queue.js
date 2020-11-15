

module.exports = Queue;

class Queue {
    _first = null;
    _last = null;

    enqueue(item) {
        let node = new QNode(this._first, item);
        this._first = node;
        if (this._last === null) {
            this._last = node;
        }
    }

    dequeue() {
        if (this._last === null) throw new Error("Queue empty.");
        let item = this._last.item;
        this._last = this._last.prev;
        return item;
    }

    count() {
        let cnt = 0;
        for (let qn = this._first; qn !== null; qn = qn.next) {
            ++cnt;
        }
        return cnt;
    }
}


class QNode {
    prev = null;
    next = null;
    item = null;

    constructor(next, item) {
        this.prev = null;
        this.next = next;
        this.item = item;
    }
}