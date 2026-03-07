import { useNavigate } from "react-router-dom"

function Home(){

const navigate = useNavigate()

return(

<div className="min-h-screen bg-gray-100">

{/* Navbar */}

<div className="flex justify-between items-center px-10 py-4 bg-white shadow">

<h1 className="text-xl font-semibold">
LexConnect
</h1>

<div className="space-x-4">

<button
className="text-gray-700"
onClick={()=>navigate("/login")}
>
Login
</button>

<button
className="bg-blue-600 text-white px-4 py-2 rounded"
onClick={()=>navigate("/register")}
>
Register
</button>

</div>

</div>

{/* Hero */}

<div className="flex flex-col items-center justify-center text-center mt-32">

<h1 className="text-5xl font-bold mb-6">
AI Powered Legal Assistance
</h1>

<p className="text-gray-600 max-w-xl mb-10">
LexConnect helps clients find the right lawyers while providing AI-powered legal insights from Indian civil case judgments.
</p>

<button
className="bg-blue-600 text-white px-6 py-3 rounded-lg"
onClick={()=>navigate("/register")}
>
Get Started
</button>

</div>

{/* Features */}

<div className="grid grid-cols-3 gap-10 px-20 mt-40">

<div className="bg-white p-6 shadow rounded">

<h3 className="font-semibold mb-2">
AI Legal Assistant
</h3>

<p className="text-gray-600">
Ask legal questions and get answers based on real Indian case judgments.
</p>

</div>

<div className="bg-white p-6 shadow rounded">

<h3 className="font-semibold mb-2">
Find Lawyers
</h3>

<p className="text-gray-600">
Automatically match with lawyers based on your legal issue.
</p>

</div>

<div className="bg-white p-6 shadow rounded">

<h3 className="font-semibold mb-2">
Case Management
</h3>

<p className="text-gray-600">
Manage cases and communicate with lawyers in one platform.
</p>

</div>

</div>

</div>

)

}

export default Home