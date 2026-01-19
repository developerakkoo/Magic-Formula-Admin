import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, MenuController, ToastController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone:false
})
export class LoginPage implements OnInit {

  form:any;
  constructor(
    private fb: FormBuilder,
    private menuController: MenuController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private router: Router,
    private authService: AuthService
  ) {
    this.menuController.enable(false);
    this.form = this.fb.group({
      email:['admin@gmail.com',[Validators.email, Validators.required]],
      password:['test123',[Validators.required, Validators.minLength(4)]]
    })
   }

  ngOnInit() {
  }

  ionViewDidEnter(){
    // Check if already logged in
    this.checkAuthStatus();
  }

  async checkAuthStatus() {
    const isAuthenticated = await this.authService.isAuthenticated();
    if (isAuthenticated) {
      this.router.navigate(['folder', 'Dashboard']);
    }
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
        this.router.navigate(['folder', 'home']);

    if (!this.form.valid) {
      await this.presentToast('Please fill in all fields correctly', 'danger');
      return;
    }

    const loading = await this.loadingController.create({
      message: "Logging you in...",
      spinner: 'crescent'
    });
    
    await loading.present();

    const { email, password } = this.form.value;

    this.authService.login(email, password).subscribe({
      next: async (response) => {
        await loading.dismiss();
        await this.presentToast('Login successful!', 'success');
        this.router.navigate(['folder', 'Dashboard']);
      },
      error: async (error) => {
        await loading.dismiss();
        const errorMessage = error?.error?.message || 'Login failed. Please try again.';
        await this.presentToast(errorMessage, 'danger');
      }
    });
  }
}
