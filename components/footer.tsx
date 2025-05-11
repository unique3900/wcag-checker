import Link from 'next/link';
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className=" rounded-md px-4 font-bold max-w-fit mx-auto  w-fit text-white text-center py-4">
      Designed and Devloped by <Link href="https://github.com/unique3900" className="text-blue-500 hover:text-blue-600" target="_blank">Parashar</Link> 
    </footer>
  );
};

export default Footer;

