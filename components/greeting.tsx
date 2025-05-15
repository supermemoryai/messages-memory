import { motion } from 'framer-motion';

export const Greeting = () => {
  return (
    <div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20 px-8 size-full flex flex-col justify-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
        className="text-2xl font-semibold"
      >
        Chat forever, with{' '}
        <a
          href="https://supermemory.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="font-extrabold"
        >
          Supermemory
        </a>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
        className="text-2xl text-zinc-500"
      >
        Add it to your app{' '}
        <a
          href="https://docs.supermemory.ai/infinite-chat"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          in one line
        </a>
      </motion.div>
    </div>
  );
};
