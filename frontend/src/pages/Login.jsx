import { useState } from "react"
import { useNavigate } from "react-router-dom"

function Login(){

const navigate = useNavigate()

const [email,setEmail] = useState("")
const [password,setPassword] = useState("")

const handleLogin = async (e)=>{
e.preventDefault()

const res = await fetch("http://127.0.0.1:8000/login",{
method:"POST",
headers:{
"Content-Type":"application/x-www-form-urlencoded"
},
body:new URLSearchParams({
username:email,
password:password
})
})

const data = await res.json()

if(data.role==="client"){
navigate("/client")
}

if(data.role==="lawyer"){
navigate("/lawyer")
}

}

return(

<div style={{padding:40}}>

<h2>Login</h2>

<form onSubmit={handleLogin}>

<input
type="email"
placeholder="Email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
/>

<br/><br/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
/>

<br/><br/>

<button type="submit">
Login
</button>

</form>

</div>

)

}

export default Login