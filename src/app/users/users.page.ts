import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-users',
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  standalone:false

})
export class UsersPage implements OnInit {

  user:any[] =[];

  constructor(private modalController: ModalController,
              
  ) { }

  ngOnInit() {
  }



  addUser(){
    console.log("add user");
    
  }

}
