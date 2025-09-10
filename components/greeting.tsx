import { motion } from 'framer-motion';

export const Greeting = () => {
  return (
    <div
      className="max-w-3xl mx-auto md:mt-20 px-8 size-full flex flex-col justify-center"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-semibold"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
      >
        Chat forever, with{' '}
        <a
          className="font-extrabold"
          href="https://supermemory.ai"
          rel="noopener noreferrer"
          target="_blank"
        >
          Supermemory
        </a>
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl text-muted-foreground"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
      >
        Add it to your app{' '}
        <a
          className="underline underline-offset-4"
          href="https://supermemory.ai/docs/model-enhancement/getting-started"
          rel="noopener noreferrer"
          target="_blank"
        >
          in one line
        </a>
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl text-muted-foreground flex mt-8"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 1 }}
      >
        ...and memory is built in. Just restart the chat and supermemory will
        remember.
      </motion.div>
    </div>
  );
};
