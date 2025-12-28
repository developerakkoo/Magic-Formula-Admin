import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, MenuController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone:false
})
export class LoginPage implements OnInit {

  form:any;
  constructor(private fb: FormBuilder,
              private menuController: MenuController,
              private loadingController: LoadingController,
              private toastController: ToastController,
              private router: Router
  ) {
    this.menuController.enable(false);
    this.form = this.fb.group({
      email:['',[Validators.email, Validators.required]],
      password:['',[Validators.required, Validators.min(4)]]
    })
   }

  ngOnInit() {
  }


  ionViewDidEnter(){

  }


  async presentToast(msg:string, color:string) {
    const toast = await this.toastController.create({
      message: msg,
      color:color,
      duration: 2000
    });
    toast.present();
  }


async onSubmit(){
  let loading = await this.loadingController.create({
    message:"Logging you in...",
    duration:2000
  });
  
  await loading.present();

  if(this.form.valid){
    await loading.dismiss();
    console.log(this.form.value);
      this.router.navigate(['folder','Dashboard'])
    }
  }


}
