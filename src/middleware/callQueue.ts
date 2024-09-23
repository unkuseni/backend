import { EventEmitter } from "events";

interface User {
  id: string;
  isGuest: boolean;
  socketId: string;
  gender: string;
  genderPreference: string;
}

class CallQueue extends EventEmitter {
  private queues: { [key: string]: User[] } = {
    male: [],
    female: [],
    other: [],
  };

  addToQueue(user: User) {
    this.queues[user.gender].push(user);
    this.emit("userAdded");
  }

  removeFromQueue(userId: string) {
    Object.values(this.queues).forEach((queue) => {
      const index = queue.findIndex((u) => u.id === userId);
      if (index !== -1) queue.splice(index, 1);
    });
  }

  getPair(): [User, User] | null {
    for (const [gender, queue] of Object.entries(this.queues)) {
      for (let i = 0; i < queue.length; i++) {
        const user1 = queue[i];
        let potentialMatch: User | undefined;

        if (user1.genderPreference === "any") {
          potentialMatch = this.findAnyMatch(user1);
        } else {
          potentialMatch = this.findSpecificMatch(
            user1,
            user1.genderPreference,
          );
        }

        if (potentialMatch) {
          this.removeFromQueue(user1.id);
          this.removeFromQueue(potentialMatch.id);
          return [user1, potentialMatch];
        }
      }
    }
    return null;
  }

  private findAnyMatch(user: User): User | undefined {
    for (const queue of Object.values(this.queues)) {
      const match = queue.find(
        (u) =>
          u !== user &&
          (u.genderPreference === "any" || u.genderPreference === user.gender),
      );
      if (match) return match;
    }
  }

  private findSpecificMatch(
    user: User,
    preferredGender: string,
  ): User | undefined {
    return this.queues[preferredGender].find(
      (u) =>
        u !== user &&
        (u.genderPreference === "any" || u.genderPreference === user.gender),
    );
  }

  getQueueLengths() {
    return {
      male: this.queues.male.length,
      female: this.queues.female.length,
      other: this.queues.other.length,
    };
  }
}

export const callQueue = new CallQueue();
