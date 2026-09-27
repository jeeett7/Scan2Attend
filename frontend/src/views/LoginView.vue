<template>
  <div class="page">

    <!-- ================= HEADER ================= -->

    <header class="header">

      <div class="logo">
        ✓
      </div>

      <h1>
        <span class="dark">Scan</span>
        <span class="teal">2</span>
        <span class="dark">Attend</span>
      </h1>

      <div class="title-line"></div>

      <p class="subtitle">
        SMART ATTENDANCE MANAGEMENT SYSTEM
      </p>

    </header>


    <!-- ================= MAIN ================= -->

    <main class="main">


      <!-- ================= LOGIN SIDE ================= -->

      <section class="login-side">

        <div class="login-card">


          <!-- Welcome -->

          <div class="welcome">

            <div class="welcome-icon">
              ✓
            </div>

            <div>

              <h2>
                Welcome back
              </h2>

              <p>
                Login to continue to your account
              </p>

              <div class="small-line"></div>

            </div>

          </div>



          <form @submit.prevent="login">


            <!-- LOGIN TYPE -->

            <label>
              Login as
            </label>

            <div class="input-box">

              <select v-model="role">

                <option value="student">
                  Student
                </option>

                <option value="teacher">
                  Teacher
                </option>

                <option value="admin">
                  Administrator
                </option>

              </select>

              <span class="select-arrow">
                ⌄
              </span>

            </div>



            <!-- ROLL NUMBER / EMAIL -->

            <label>

              {{
                role === 'student'
                  ? 'Roll Number'
                  : 'Email Address'
              }}

            </label>

            <div class="input-box">

              <input
                v-if="role === 'student'"
                type="text"
                v-model="identifier"
                placeholder="Enter your roll number"
              />

              <input
                v-else
                type="email"
                v-model="identifier"
                placeholder="Enter your registered email"
              />

            </div>



            <!-- PASSWORD -->

            <div class="password-title">

              <label>
                Password
              </label>

              <button
                type="button"
                @click="forgotPassword"
              >
                Forgot password?
              </button>

            </div>


            <div class="input-box">

              <input
                :type="
                  showPassword
                    ? 'text'
                    : 'password'
                "
                v-model="password"
                placeholder="Enter your password"
              />

              <button
                type="button"
                class="show-password"
                @click="
                  showPassword = !showPassword
                "
              >

                {{
                  showPassword
                    ? 'Hide'
                    : 'Show'
                }}

              </button>

            </div>



            <!-- LOGIN BUTTON -->

            <button
              class="login-button"
              type="submit"
            >

              <span>
                Login
              </span>

              <span class="arrow">
                →
              </span>

            </button>


          </form>



          <!-- LOGIN NOTE -->

          <div class="login-note">

            <span v-if="role === 'student'">

              Students login using their roll number.

            </span>

            <span v-else>

              {{
                role === 'teacher'
                  ? 'Teachers login using their registered email.'
                  : 'Administrators login using their registered email.'
              }}

            </span>

          </div>


        </div>

      </section>



      <!-- ================= DIVIDER ================= -->

      <div class="divider"></div>



      <!-- ================= RIGHT SIDE ================= -->

      <section class="right-side">

        <div class="right-content">


          <div class="smart">

            <span></span>

            SMART ATTENDANCE

          </div>


          <h2>

            Mark your

            <br>

            <strong>
              presence.
            </strong>

          </h2>


          <p class="description">

            Attendance made simple, fast and secure.

          </p>



          <!-- ================= LAPTOP ================= -->

          <div class="illustration">


            <!-- Laptop -->

            <div class="computer">


              <!-- Screen -->

              <div class="monitor">

                <div class="screen">


                  <!-- Screen title -->

                  <div class="screen-title">

                    <span>
                      Attendance
                    </span>

                    <small>
                      TODAY
                    </small>

                  </div>



                  <!-- Student row -->

                  <div class="attendance-row">

                    <div class="mini-avatar">
                      A
                    </div>

                    <div class="student-lines">

                      <span></span>

                      <span></span>

                    </div>

                    <div class="check">
                      ✓
                    </div>

                  </div>



                  <!-- Student row -->

                  <div class="attendance-row">

                    <div class="mini-avatar grey">
                      R
                    </div>

                    <div class="student-lines">

                      <span></span>

                      <span></span>

                    </div>

                    <div class="check">
                      ✓
                    </div>

                  </div>



                  <!-- Present -->

                  <div class="present-box">

                    <div class="present-check">
                      ✓
                    </div>

                    <div>

                      <strong>
                        PRESENT
                      </strong>

                      <small>
                        Attendance recorded
                      </small>

                    </div>

                  </div>


                </div>

              </div>



              <!-- Laptop base -->

              <div class="laptop-bottom">

                <div class="keyboard">

                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>

                </div>

                <div class="trackpad"></div>

              </div>


            </div>



            <!-- Floating check -->

            <div class="floating-check">
              ✓
            </div>


            <!-- Small calendar -->

            <div class="calendar">

              <div class="calendar-head"></div>

              <div class="calendar-body">

                <span></span>
                <span></span>
                <span class="marked">
                  ✓
                </span>
                <span></span>

                <span></span>
                <span class="marked">
                  ✓
                </span>
                <span></span>
                <span></span>

                <span class="marked">
                  ✓
                </span>
                <span></span>
                <span></span>
                <span class="marked">
                  ✓
                </span>

              </div>

            </div>


          </div>



          <!-- Bottom message -->

          <div class="presence-text">

            <div class="presence-icon">
              ✓
            </div>

            <div>

              <strong>
                Your presence matters.
              </strong>

              <small>
                Mark attendance. Stay on track.
              </small>

            </div>

          </div>


        </div>

      </section>

    </main>

  </div>
</template>



<script>
import { ref } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'

export default {
  setup() {
    const router = useRouter()
    const route = useRoute()
    const apiUrl =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api'
    const role = ref('student')
    const identifier = ref('')
    const password = ref('')
    const showPassword = ref(false)

    const login = async () => {
      if (!identifier.value || !password.value) {
        alert('Please enter your login details.')
        return
      }

      try {
        const response = await axios.post(
          `${apiUrl}/auth/login`,
          {
            identifier: identifier.value,
            password: password.value,
            role: role.value
          }
        )

        localStorage.setItem(
          'scan2attend_token',
          response.data.token
        )

        localStorage.setItem(
          'scan2attend_user',
          JSON.stringify(response.data.user)
        )

        const requestedNext = route.query.next

        const pendingAttendanceClaim = sessionStorage.getItem(
          'scan2attend_pending_attendance_claim'
        )

        const attendanceClaimAfterLogin =
          typeof requestedNext === 'string' &&
          requestedNext.startsWith('/attendance/scan/claim/')
            ? requestedNext.split('/').pop()
            : null

        const scanPageAfterLogin =
          typeof requestedNext === 'string' &&
          requestedNext.startsWith('/attendance/scan')
            ? requestedNext
            : null

        if (
          response.data.user.role === 'student' &&
          scanPageAfterLogin
        ) {
          if (
            pendingAttendanceClaim &&
            attendanceClaimAfterLogin === pendingAttendanceClaim
          ) {
            sessionStorage.setItem(
              'scan2attend_fresh_attendance_claim',
              pendingAttendanceClaim
            )
            sessionStorage.removeItem(
              'scan2attend_pending_attendance_claim'
            )
          }

          router.replace(scanPageAfterLogin)
          return
        }

        if (response.data.user.role === 'admin') {
          router.push('/admin/dashboard')
        } else if (response.data.user.role === 'teacher') {
          router.push('/teacher/dashboard')
        } else {
          router.push('/student/dashboard')
        }
      } catch (error) {
        alert(
          error.response?.data?.message ||
          'Could not reach the server. Please try again.'
        )
      }
    }

    const forgotPassword = () => {
      alert('Password recovery will be connected later.')
    }

    return {
      role,
      identifier,
      password,
      showPassword,
      login,
      forgotPassword
    }
  }
}
</script>



<style scoped>

/* =====================================================
   RESET
===================================================== */

* {
  box-sizing: border-box;
}


/* =====================================================
   PAGE
===================================================== */

.page {

  min-height: 100vh;

  width: 100%;

  padding:
    18px 5vw 25px;

  overflow: hidden;

  font-family:
    "Segoe UI",
    Arial,
    sans-serif;

  color: #293b45;

  background:
    linear-gradient(
      135deg,
      #dfeceb 0%,
      #edf2f2 48%,
      #d6e4e2 100%
    );

}



/* =====================================================
   HEADER
===================================================== */

.header {

  text-align: center;

  margin-bottom: 23px;

}


.logo {

  width: 48px;

  height: 48px;

  margin: auto;

  border-radius: 14px;

  display: flex;

  align-items: center;

  justify-content: center;

  background:
    #119e91;

  color: white;

  font-size: 28px;

  font-weight: 800;

  box-shadow:
    0 7px 18px
    rgba(17,158,145,.18);

}


.header h1 {

  margin:
    7px 0 0;

  font-size:
    clamp(42px, 5vw, 61px);

  line-height: 1;

  letter-spacing:
    -2.5px;

  font-weight: 800;

}


.dark {

  color:
    #293b45;

}


.teal {

  color:
    #119e91;

}


.title-line {

  width:
    175px;

  height:
    3px;

  margin:
    9px auto 7px;

  border-radius:
    10px;

  background:
    #119e91;

}


.subtitle {

  margin: 0;

  color:
    #68787e;

  font-size:
    10px;

  font-weight:
    600;

  letter-spacing:
    4px;

}



/* =====================================================
   MAIN
===================================================== */

.main {

  max-width:
    1220px;

  margin:
    auto;

  display:
    grid;

  grid-template-columns:
    .9fr 1px 1.1fr;

  gap:
    45px;

  align-items:
    center;

}



/* =====================================================
   LOGIN SIDE
===================================================== */

.login-side {

  display:
    flex;

  justify-content:
    center;

}


.login-card {

  width:
    100%;

  max-width:
    490px;

  padding:
    29px 36px 23px;

  background:
    rgba(250,252,252,.95);

  border-radius:
    21px;

  box-shadow:
    0 17px 42px
    rgba(35,55,65,.12);

}



/* =====================================================
   WELCOME
===================================================== */

.welcome {

  display:
    flex;

  align-items:
    flex-start;

  gap:
    14px;

  margin-bottom:
    24px;

}


.welcome-icon {

  width:
    49px;

  height:
    49px;

  flex-shrink:
    0;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  border-radius:
    13px;

  background:
    #d6ebe8;

  color:
    #119e91;

  font-size:
    24px;

  font-weight:
    800;

}


.welcome h2 {

  margin:
    0;

  color:
    #293b45;

  font-size:
    23px;

}


.welcome p {

  margin:
    4px 0 0;

  color:
    #718087;

  font-size:
    13px;

}


.small-line {

  width:
    37px;

  height:
    3px;

  margin-top:
    8px;

  border-radius:
    5px;

  background:
    #119e91;

}



/* =====================================================
   FORM
===================================================== */

label {

  display:
    block;

  margin-bottom:
    7px;

  color:
    #30424c;

  font-size:
    13px;

  font-weight:
    650;

}


.input-box {

  position:
    relative;

  margin-bottom:
    17px;

}


.input-box input,
.input-box select {

  width:
    100%;

  height:
    48px;

  padding:
    0 15px;

  border:
    1px solid #cedbdc;

  border-radius:
    10px;

  outline:
    none;

  background:
    #edf2f2;

  color:
    #293b45;

  font-size:
    14px;

}


.input-box input:focus,
.input-box select:focus {

  border-color:
    #119e91;

  background:
    white;

  box-shadow:
    0 0 0 3px
    rgba(17,158,145,.08);

}


.input-box select {

  appearance:
    none;

  cursor:
    pointer;

}


.select-arrow {

  position:
    absolute;

  right:
    15px;

  top:
    12px;

  color:
    #68787e;

  font-size:
    18px;

  pointer-events:
    none;

}



/* =====================================================
   PASSWORD
===================================================== */

.password-title {

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

}


.password-title button {

  border:
    none;

  background:
    none;

  color:
    #119e91;

  font-size:
    11px;

  cursor:
    pointer;

  margin-bottom:
    7px;

}


.show-password {

  position:
    absolute;

  right:
    12px;

  top:
    13px;

  border:
    none;

  background:
    none;

  color:
    #718087;

  font-size:
    11px;

  cursor:
    pointer;

}



/* =====================================================
   LOGIN BUTTON
===================================================== */

.login-button {

  width:
    100%;

  height:
    50px;

  margin-top:
    2px;

  border:
    none;

  border-radius:
    10px;

  background:
    #119e91;

  color:
    white;

  font-size:
    15px;

  font-weight:
    700;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  gap:
    25px;

  cursor:
    pointer;

  transition:
    .2s;

}


.login-button:hover {

  background:
    #0d897e;

  transform:
    translateY(-1px);

}


.arrow {

  font-size:
    21px;

  font-weight:
    400;

}


.login-note {

  margin-top:
    15px;

  text-align:
    center;

  color:
    #78878c;

  font-size:
    10px;

}



/* =====================================================
   DIVIDER
===================================================== */

.divider {

  width:
    1px;

  height:
    440px;

  background:
    rgba(40,60,70,.15);

}



/* =====================================================
   RIGHT SIDE
===================================================== */

.right-side {

  min-height:
    460px;

  display:
    flex;

  align-items:
    center;

  padding-left:
    20px;

}


.right-content {

  width:
    100%;

  max-width:
    650px;

}


.smart {

  display:
    flex;

  align-items:
    center;

  gap:
    9px;

  color:
    #108e83;

  font-size:
    12px;

  font-weight:
    750;

  letter-spacing:
    3px;

  margin-bottom:
    12px;

}


.smart span {

  width:
    8px;

  height:
    8px;

  border-radius:
    50%;

  background:
    #119e91;

}


.right-content h2 {

  margin:
    0;

  color:
    #293b45;

  font-size:
    clamp(43px, 5vw, 63px);

  line-height:
    .98;

  letter-spacing:
    -2px;

}


.right-content h2 strong {

  color:
    #119e91;

}


.description {

  margin:
    17px 0 4px;

  color:
    #68787e;

  font-size:
    14px;

  line-height:
    1.6;

}



/* =====================================================
   ILLUSTRATION
===================================================== */

.illustration {

  width:
    100%;

  height:
    270px;

  position:
    relative;

  margin-top:
    5px;

}



/* =====================================================
   COMPUTER
===================================================== */

.computer {

  position:
    absolute;

  width:
    370px;

  height:
    245px;

  left:
    50%;

  bottom:
    5px;

  transform:
    translateX(-50%);

}



/* =====================================================
   MONITOR
===================================================== */

.monitor {

  width:
    370px;

  height:
    218px;

  padding:
    9px;

  background:
    #263e49;

  border-radius:
    17px;

  box-shadow:
    0 14px 28px
    rgba(35,55,65,.18);

}


.screen {

  width:
    100%;

  height:
    100%;

  padding:
    16px;

  background:
    #f1f5f4;

  border-radius:
    9px;

}



/* Screen title */

.screen-title {

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  margin-bottom:
    11px;

}


.screen-title span {

  color:
    #293b45;

  font-size:
    15px;

  font-weight:
    750;

}


.screen-title small {

  color:
    #829094;

  font-size:
    9px;

  font-weight:
    650;

}



/* Attendance row */

.attendance-row {

  height:
    40px;

  margin-bottom:
    8px;

  padding:
    6px 9px;

  display:
    flex;

  align-items:
    center;

  gap:
    9px;

  background:
    white;

  border-radius:
    7px;

}


.mini-avatar {

  width:
    27px;

  height:
    27px;

  border-radius:
    50%;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  background:
    #cce8e5;

  color:
    #119e91;

  font-size:
    9px;

  font-weight:
    750;

}


.mini-avatar.grey {

  background:
    #dfe5e6;

  color:
    #728087;

}


.student-lines {

  flex:
    1;

}


.student-lines span {

  display:
    block;

  height:
    5px;

  margin:
    4px 0;

  border-radius:
    5px;

  background:
    #d4dfe0;

}


.student-lines span:first-child {

  width:
    70%;

}


.student-lines span:last-child {

  width:
    45%;

}


.check {

  width:
    22px;

  height:
    22px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  border-radius:
    50%;

  background:
    #d8efeb;

  color:
    #119e91;

  font-size:
    12px;

  font-weight:
    800;

}



/* Present */

.present-box {

  height:
    42px;

  margin-top:
    7px;

  padding:
    0 12px;

  display:
    flex;

  align-items:
    center;

  gap:
    10px;

  border-radius:
    8px;

  background:
    #119e91;

  color:
    white;

}


.present-check {

  width:
    25px;

  height:
    25px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  border-radius:
    50%;

  background:
    rgba(0,0,0,.12);

  font-size:
    13px;

}


.present-box strong {

  display:
    block;

  font-size:
    11px;

}


.present-box small {

  display:
    block;

  margin-top:
    2px;

  font-size:
    8px;

  opacity:
    .85;

}



/* =====================================================
   LAPTOP BASE
===================================================== */

.laptop-bottom {

  position:
    absolute;

  width:
    400px;

  height:
    27px;

  left:
    -15px;

  bottom:
    0;

  background:
    #bdc9ca;

  border-radius:
    4px 4px 12px 12px;

  box-shadow:
    0 8px 15px
    rgba(35,55,65,.12);

}


.laptop-bottom::after {

  content:
    "";

  position:
    absolute;

  left:
    50%;

  bottom:
    2px;

  transform:
    translateX(-50%);

  width:
    120px;

  height:
    4px;

  border-radius:
    5px;

  background:
    #9eabad;

}


.keyboard {

  position:
    absolute;

  left:
    40px;

  top:
    5px;

  display:
    flex;

  gap:
    7px;

}


.keyboard span {

  width:
    17px;

  height:
    4px;

  border-radius:
    3px;

  background:
    #9eabad;

}


.trackpad {

  position:
    absolute;

  left:
    50%;

  top:
    12px;

  transform:
    translateX(-50%);

  width:
    55px;

  height:
    8px;

  border:
    1px solid #a5b1b3;

  border-radius:
    3px;

}



/* =====================================================
   FLOATING CHECK
===================================================== */

.floating-check {

  position:
    absolute;

  left:
    9%;

  bottom:
    47px;

  width:
    43px;

  height:
    43px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  border-radius:
    50%;

  background:
    #d6eeeb;

  color:
    #119e91;

  font-size:
    23px;

  font-weight:
    800;

  box-shadow:
    0 7px 18px
    rgba(17,158,145,.12);

}



/* =====================================================
   CALENDAR
===================================================== */

.calendar {

  position:
    absolute;

  right:
    2%;

  bottom:
    18px;

  width:
    82px;

  height:
    92px;

  padding:
    0 9px;

  background:
    white;

  border-radius:
    9px;

  box-shadow:
    0 8px 22px
    rgba(35,55,65,.13);

  transform:
    rotate(3deg);

}


.calendar-head {

  height:
    18px;

  margin:
    0 -9px;

  border-radius:
    9px 9px 0 0;

  background:
    #119e91;

}


.calendar-body {

  display:
    grid;

  grid-template-columns:
    repeat(4, 1fr);

  gap:
    6px;

  padding-top:
    10px;

}


.calendar-body span {

  height:
    8px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  border-radius:
    2px;

  background:
    #dce4e5;

  color:
    #119e91;

  font-size:
    7px;

}


.calendar-body .marked {

  background:
    #d9efec;

  color:
    #119e91;

  font-weight:
    800;

}



/* =====================================================
   BOTTOM TEXT
===================================================== */

.presence-text {

  display:
    flex;

  align-items:
    center;

  gap:
    10px;

  margin-left:
    17%;

}


.presence-icon {

  width:
    32px;

  height:
    32px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  border-radius:
    50%;

  background:
    #119e91;

  color:
    white;

  font-size:
    17px;

  font-weight:
    800;

}


.presence-text strong {

  display:
    block;

  color:
    #3c5059;

  font-size:
    12px;

}


.presence-text small {

  display:
    block;

  margin-top:
    2px;

  color:
    #859196;

  font-size:
    9px;

}



/* =====================================================
   SHORT SCREENS
===================================================== */

@media (max-height: 800px) {

  .page {

    padding-top:
      10px;

  }


  .header {

    margin-bottom:
      15px;

  }


  .logo {

    width:
      40px;

    height:
      40px;

    font-size:
      24px;

  }


  .header h1 {

    font-size:
      50px;

  }


  .subtitle {

    font-size:
      8px;

  }


  .main {

    min-height:
      450px;

  }


  .login-card {

    padding:
      24px 32px 20px;

  }


  .right-side {

    min-height:
      430px;

  }


  .illustration {

    height:
      235px;

  }


  .computer {

    transform:
      translateX(-50%)
      scale(.88);

    transform-origin:
      bottom center;

  }

}



/* =====================================================
   TABLET
===================================================== */

@media (max-width: 850px) {

  .main {

    grid-template-columns:
      1fr;

  }


  .divider {

    display:
      none;

  }


  .right-side {

    border-top:
      1px solid rgba(40,60,70,.14);

    padding:
      35px 0 0;

  }

}



/* =====================================================
   MOBILE
===================================================== */

@media (max-width: 550px) {

  .page {

    padding:
      15px;

  }


  .header h1 {

    font-size:
      40px;

  }


  .subtitle {

    letter-spacing:
      2px;

  }


  .login-card {

    padding:
      24px 20px;

  }


  .right-content h2 {

    font-size:
      45px;

  }


  .illustration {

    transform:
      scale(.78);

    transform-origin:
      left center;

    width:
      128%;

  }

}

</style>
