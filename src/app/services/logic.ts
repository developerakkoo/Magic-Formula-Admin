import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment.prod';

@Injectable({
  providedIn: 'root',
})
export class Logic {
  token:any;

  
  constructor(private http:HttpClient){

  } 


  //Auth Logic

  login(body:any){
    return this.http.post(environment.API_URL,body);
  }



  //Users




  //Subscriptions




  //Notifications




  //Settings



  //Security Logs


  


}
