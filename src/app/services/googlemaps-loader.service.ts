import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class GoogleMapsLoaderService {
    private apiLoaded = false;

    load(apiKey: string): Promise<boolean> {
        if (this.apiLoaded) {
            return Promise.resolve(false);
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                this.apiLoaded = true;
                resolve(true);
            };
            script.onerror = (error) => reject(false);
            document.body.appendChild(script);
        });
    }
}
