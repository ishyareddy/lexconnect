import { useState } from "react"
import { useNavigate } from "react-router-dom"

function Register(){

const navigate = useNavigate()

const [name,setName] = useState("")
const [email,setEmail] = useState("")
const [password,setPassword] = useState("")
const [role,setRole] = useState("client")

async function register(){

await fetch("http://127.0.0.1:8000/register",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
name,
email,
password,
role
})

})

alert("Registered successfully")

navigate("/")

}

return(

<div style={{padding:50,fontFamily:"Arial"}}>

<h1>Register</h1>

<input
placeholder="Name"
value={name}
onChange={e=>setName(e.target.value)}
/>

<br/><br/>

<input
placeholder="Email"
value={email}
onChange={e=>setEmail(e.target.value)}
/>

<br/><br/>

<input
type="password"
placeholder="Password"
value={password}
onChange={e=>setPassword(e.target.value)}
/>

<br/><br/>

<select value={role} onChange={e=>setRole(e.target.value)}>
<option value="client">Client</option>
<option value="lawyer">Lawyer</option>
</select>

<br/><br/>

<button onClick={register}>
Register
</button>

</div>

)

}

export default Register