import { Footer } from './components/Footer/Footer';
import { Nav } from './components/Nav/Nav';
import AI from './sections/AI';
import About from './sections/About';
import Contact from './sections/Contact';
import Experience from './sections/Experience';
import Hero from './sections/Hero';
import Drone from './sections/projects/Drone';
import SafeSurf from './sections/projects/SafeSurf';
import XRay from './sections/projects/XRay';

/** The page: composes the sections in contract order. Never needs editing; edit the sections. */
export default function App() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <About />
        <SafeSurf />
        <XRay />
        <Drone />
        <Experience />
        <AI />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
