import passport from 'passport';
import local from 'passport-local';
import jwt, { ExtractJwt } from 'passport-jwt';
import GithubStrategy from 'passport-github2';
import userModel from '../models/user.model.js';
import { createHash, isValidPassword } from '../utils/hashingUtils.js';
import dotenv from 'dotenv';

dotenv.config();
const LocalStrategy = local.Strategy;
const JWTStrategy = jwt.Strategy;

const initializePassport = () => {
    // Estrategia JWT
    passport.use('jwt', new JWTStrategy(
        {
            jwtFromRequest: ExtractJwt.fromExtractors([
                (req) => req && req.cookies ? req.cookies["preEntregaFinal"] : null
            ]),
            secretOrKey: process.env.SECRET_JWT
        },
        async (jwt_payload, done) => {
            try {
                //console.log("JWT Payload recibido:", jwt_payload);
                // Verificar que el usuario se encuentre correctamente en la base de datos
                const user = await userModel.findById(jwt_payload.user._id);  // Buscar el usuario por el ID del payload
                if (!user) return done(null, false);
                return done(null, user);  // Si el usuario existe, se pasa al siguiente middleware
            } catch (error) {
                return done(error);
            }
        }
    ));
    

    // Estrategia de registro
    passport.use('register', new LocalStrategy(
        {
            passReqToCallback: true,
            usernameField: "email"
        },
        async (req, username, password, done) => {
            const { first_name, last_name, age } = req.body;
            try {
                const user = await userModel.findOne({ email: username });
                if (user) return done(null, false, { message: "User already exists" });

                const newUser = {
                    email: username,
                    password: createHash(password),
                    first_name,
                    last_name,
                    age,
                    role: req.body.role || 'user', // Asignar 'role' enviado o 'user' por defecto
                };
                

                const result = await userModel.create(newUser);
                return done(null, result);
            } catch (error) {
                return done(error);
            }
        }
    ));

    // Estrategia de login
    passport.use('login', new LocalStrategy(
    { usernameField: 'email' },
    async (username, password, done) => {
        try {
            const user = await userModel.findOne({ email: username });
            if (!user) return done(null, false, { message: "User not found" });
            if (!isValidPassword(user, password)) return done(null, false, { message: "Invalid password" });

            // Solo devolver los campos necesarios para la autenticación
            const userData = {
                _id: user._id,
                email: user.email,
                role: user.role,
                first_name: user.first_name,
                last_name: user.last_name,
                age: user.age
            };
            
            return done(null, userData);
        } catch (error) {
            return done(error);
        }
    }
));

    // Estrategia GitHub
    passport.use('github', new GithubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID, 
          clientSecret: process.env.GITHUB_CLIENT_SECRET, 
          callbackURL: process.env.GITHUB_CALLBACK_URL, 
        },
        async (_, __, profile, done) => {
          try {
            const user = await userModel.findOne({ idGithub: profile._json.id });
            if (user) return done(null, user);
      
            const newUser = {
              first_name: profile._json.name,
              idGithub: profile._json.id,
            };
            const result = await userModel.create(newUser);
            return done(null, result);
          } catch (error) {
            done(error);
          }
        }
      ));
      
};

export default initializePassport;
