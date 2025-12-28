import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root',
})
export class Data {
    constructor(private storage:Storage){
      this.init();
    }

    init(){
      this.storage.create();
    }

    set(key:string, value:any){
      return this.storage.set(key,value);
    }

    get(key:string){
      return this.storage.get(key);
    }

    removeKey(key:string){
      return this.storage.remove(key);
    }

    removeAll(){
      return this.storage.clear();
    }
}
