const common=require('./webpack.common');module.exports=(env,argv)=>({...common(env,{...argv,mode:'development'}),mode:'development',devServer:{static:'./build/dev',hot:true,open:true,port:3000}});
