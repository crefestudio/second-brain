import { Injectable } from '@angular/core';
import {
    collection, Timestamp, query, orderBy, where, onSnapshot
} from 'firebase/firestore';
import { firestore } from '../firebase';

export interface UserEvent {
    id: string;
    eventType: string;
    status: 'start' | 'running' | 'completed' | 'failed';
    targetData?: any;
    eventTitle?: string;
    eventDescription?: string;
    updatedAt: any;
}

@Injectable({ providedIn: 'root' })
export class EventListenerService {

    listenUserEventsRealtime(
        userId: string,
        onEvent: (event: UserEvent) => void
    ): () => void {

        const ref = collection(firestore, `users/${userId}/event`);

        // 🔑 리스너 등록 시점 (클라이언트 기준)
        const clientNow = Timestamp.now();

        const q = query(
            ref,
            where('updatedAt', '>', clientNow),
            orderBy('updatedAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type !== 'added') return;

                const event: UserEvent = {
                    id: change.doc.id,
                    ...(change.doc.data() as Omit<UserEvent, 'id'>),
                };

                onEvent(event);
            });
        });

        return unsubscribe;
    }
}
