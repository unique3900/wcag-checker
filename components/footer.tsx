import { Braces } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className=" rounded-md px-4 font-bold max-w-fit mx-auto  flex items-center gap-2 w-fit text-white text-center py-4">
       <Link href="https://github.com/unique3900" className="border border-white hover:border-blue-500 rounded-md p-4 hover:bg-white hover:text-black transition-all duration-300 text-white  flex items-end gap-2" target="_blank"><Braces /> <span className='text-sm'>Contribute on Github</span></Link>
    </footer>
  );
};

export default Footer;

